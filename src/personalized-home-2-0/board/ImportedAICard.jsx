import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { validateAICardPackage } from './ai-card-import';
import './imported-ai-card.css';

const encode = value => JSON.stringify(value).replace(/</g, '\\u003c');
function iframeDocument(pkg, token) {
  const nonce = token.replaceAll('-', '');
  const bootstrap = `
const token=${encode(token)}, pkg=${encode(pkg)};
let card, ctx, destroyed=false, sequence=0;
const pending=new Map();
const send=(type,data={})=>parent.postMessage({channel:'tabbit-local-ai',token,type,...data},'*');
const call=(method,...args)=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('操作超时'));},8000);pending.set(id,{resolve,reject,timer});send('call',{id,method,args});});
const host=Object.freeze({get ctx(){return ctx;},openModal:()=>call('openModal'),closeModal:()=>call('closeModal'),fetchData:()=>Promise.reject(new Error('当前未连接在线数据源')),storage:Object.freeze({get:key=>call('storage.get',key),list:options=>call('storage.list',options),set:(key,value)=>call('storage.set',key,value),delete:key=>call('storage.delete',key),batch:ops=>call('storage.batch',ops)})});
function update(next){ctx=Object.freeze(next);for(const [key,value]of Object.entries(next.colors||{})){document.documentElement.style.setProperty('--tabbit-card-'+key,value);document.documentElement.style.setProperty('--tabbit-theme-'+key,value);}document.documentElement.style.setProperty('--tabbit-theme-muted-foreground',next.colors.muted);card?.updateTabbitContext?.(ctx);}
addEventListener('message',async event=>{if(event.source!==parent||event.data?.token!==token)return;const m=event.data;
 if(m.type==='response'){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.result);}return;}
 if(m.type==='context'){update(m.ctx);return;}
 if(m.type==='storage-change'){card?.dispatchEvent(new CustomEvent('tabbit:storage-change',{detail:{eventVersion:1,reason:'mutation',keys:m.keys}}));return;}
 if(m.type==='destroy'){destroyed=true;card?.destroy?.();card?.remove();return;}
 if(m.type==='mount'&&!card&&!destroyed){try{update(m.ctx);const url=URL.createObjectURL(new Blob([pkg.artifact.sourceCode],{type:'text/javascript'}));let module;try{module=await import(url);}finally{URL.revokeObjectURL(url);}if(destroyed)return;customElements.define('local-ai-widget',module.default);card=document.createElement('local-ai-widget');card.tabbitHost=host;card.style.cssText='position:fixed;inset:0;display:block;width:100%;height:100%;border:0;border-radius:0;background:transparent;box-sizing:border-box';document.body.append(card);card.updateTabbitContext?.(ctx);send('ready');}catch(error){send('error',{message:String(error.message||error).slice(0,300)});}}
});
addEventListener('error',event=>send('error',{message:String(event.message).slice(0,300)}));
send('boot');`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;color:var(--tabbit-card-foreground);font:14px system-ui}*{box-sizing:border-box}</style></head><body><script type="module" nonce="${nonce}">${bootstrap}</script></body></html>`;
}

export default function ImportedAICard({ config = {}, onChange, size, preview = false, active = true }) {
  const pkg = config.aiCardPackage;
  const frameRef = useRef(null), modalFrameRef = useRef(null), dialogRef = useRef(null), containerRef = useRef(null);
  const current = useRef({ config, onChange });
  current.current = { config, onChange };
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const token = useMemo(() => crypto.randomUUID(), [pkg]);
  const validation = useMemo(() => { try { validateAICardPackage(pkg); return ''; } catch (reason) { return reason.message; } }, [pkg]);
  const source = useMemo(() => validation ? '' : iframeDocument(pkg, token), [pkg, token, validation]);
  const sizeRef = useRef(size); sizeRef.current = size;

  useLayoutEffect(() => {
    setLoaded(false);setError('');
    if (validation || preview || !active) { setExpanded(false); return; }
    let disposed = false;
    const permissions = pkg.artifact.manifest.permissions?.bridge || [];
    const frames = () => [frameRef.current, modalFrameRef.current].filter(Boolean);
    function context(surface) {
      const css = getComputedStyle(containerRef.current);
      return { cardId: token, instanceId: token, surface, locale: 'zh-CN', size: `${sizeRef.current?.w || 2}x${sizeRef.current?.h || 2}`, config: { ...(pkg.artifact.manifest.catalog?.defaultConfig || {}), ...(current.current.config.aiCardConfig || {}) }, colors: { foreground: css.color, muted: css.getPropertyValue('--muted').trim() || '#888888', primary: '#589bc2', secondary: 'rgba(128,128,128,.12)', background: 'transparent', 'on-primary': '#ffffff' } };
    }
    const post = (frame, data) => frame?.contentWindow?.postMessage({ token, ...data }, '*');
    const storageEntry = key => Object.prototype.hasOwnProperty.call(current.current.config.aiCardStorage || {}, key) ? current.current.config.aiCardStorage[key] : null;
    function checkedKey(key) {
      if (typeof key !== 'string' || !key || new TextEncoder().encode(key).length > 128 || key.startsWith('__tabbit/') || ['__proto__','prototype','constructor'].includes(key)) throw new Error('存储键无效');
      return key;
    }
    async function receive(event) {
      const frame = frames().find(f => f.contentWindow === event.source);
      const message = event.data;
      if (!frame || message?.channel !== 'tabbit-local-ai' || message.token !== token || disposed) return;
      const surface = frame === modalFrameRef.current ? 'modal' : 'card';
      if (message.type === 'boot') { post(frame, { type: 'mount', ctx: context(surface) }); return; }
      if (message.type === 'ready') { setLoaded(true); setError(''); return; }
      if (message.type === 'error') { setError('卡片暂时无法显示，请检查文件内容。'); return; }
      if (message.type !== 'call' || !Number.isSafeInteger(message.id) || !Array.isArray(message.args)) return;
      let result;
      try {
        const { method, args } = message;
        if (method === 'openModal' || method === 'closeModal') {
          if (!permissions.includes(method) || !pkg.artifact.manifest.surfaces.modal) throw new Error('卡片未声明详情权限');
          setExpanded(method === 'openModal');
        } else if (typeof method === 'string' && method.startsWith('storage.')) {
          if (!permissions.includes('storage')) throw new Error('卡片未声明存储权限');
          if (method === 'storage.get') result = { entry: storageEntry(checkedKey(args[0])), source: 'cache' };
          else if (method === 'storage.list') {
            const options = args[0] || {}, prefix = typeof options.prefix === 'string' ? options.prefix : '';
            const limit = Math.max(1, Math.min(100, Number(options.limit) || 100));
            const all = Object.values(current.current.config.aiCardStorage || {}).filter(e => e.key.startsWith(prefix)).sort((a,b) => a.key.localeCompare(b.key));
            const offset = Math.max(0, Number(options.cursor) || 0), entries = all.slice(offset, offset + limit), hasMore = offset + limit < all.length;
            result = { entries, nextCursor: hasMore ? String(offset + limit) : null, hasMore, source: 'cache' };
          } else {
            const operations = method === 'storage.batch' ? args[0] : [{ op: method.slice(8), key: args[0], value: args[1] }];
            if (!Array.isArray(operations) || !operations.length || operations.length > 100) throw new Error('存储操作无效');
            const next = { ...(current.current.config.aiCardStorage || {}) }, mutationAt = new Date().toISOString(), outcomes = [];
            for (const operation of operations) {
              const key = checkedKey(operation.key);
              if (operation.op === 'set') {
                if (new TextEncoder().encode(JSON.stringify(operation.value)).length > 65536) throw new Error('内容过长，请精简后保存');
                next[key] = { key, value: operation.value, updatedAt: mutationAt }; outcomes.push({ op:'set', key, status:'written', updatedAt:mutationAt });
              } else if (operation.op === 'delete') { const exists=Object.prototype.hasOwnProperty.call(next,key); delete next[key]; outcomes.push({op:'delete',key,status:exists?'deleted':'unchanged',updatedAt:exists?mutationAt:null}); }
              else throw new Error('存储操作无效');
            }
            if (JSON.stringify(next).length > 131072) throw new Error('卡片存储已满');
            if (!current.current.onChange) throw new Error('当前卡片为只读状态');
            current.current.onChange({ aiCardStorage: next });
            current.current.config = { ...current.current.config, aiCardStorage: next };
            result = { mutationAt, outcomes };
            frames().forEach(f => post(f,{type:'storage-change',keys:outcomes.map(o=>o.key)}));
          }
        } else throw new Error('此操作不受支持');
        post(frame, { type:'response', id:message.id, result });
      } catch (reason) { post(frame, {type:'response',id:message.id,error:reason.message || '操作失败'}); }
    }
    window.addEventListener('message', receive);
    const update = () => frames().forEach(f => post(f,{type:'context',ctx:context(f === modalFrameRef.current ? 'modal' : 'card')}));
    const resize = new ResizeObserver(update); resize.observe(containerRef.current);
    const home = containerRef.current.closest('.personalized-home');
    const theme = new MutationObserver(update); if (home) theme.observe(home,{attributes:true,attributeFilter:['data-theme','style','class']});
    return () => { disposed=true;frames().forEach(f=>post(f,{type:'destroy'}));window.removeEventListener('message',receive);resize.disconnect();theme.disconnect(); };
  }, [pkg, token, validation, preview, active]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (expanded && dialog && !dialog.open) dialog.showModal();
    if (!expanded && dialog?.open) dialog.close();
  }, [expanded]);
  const name = pkg?.catalog?.title || 'AI 卡片';
  return <div className="imported-ai-card" ref={containerRef} data-board-interactive="true">
    {validation || error ? <div className="ai-card-fallback" role="status"><strong>{name}</strong><span>{validation || error}</span></div>
      : preview || !active ? <div className="ai-card-fallback"><strong>{name}</strong><span>{pkg.catalog.description}</span><small>AI 卡片 · JSON</small></div>
      : <><iframe key={token} ref={frameRef} title={name} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={source} />{!loaded && <div className="ai-card-loading" role="status">加载卡片…</div>}</>}
    {expanded && <dialog ref={dialogRef} className="ai-card-detail" aria-label={`${name}详情`} onCancel={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <header><strong>{name}</strong><button type="button" onClick={() => setExpanded(false)} aria-label="关闭 AI 卡片详情">×</button></header>
      <iframe key={`${token}-modal`} ref={modalFrameRef} title={`${name}详情`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={source} />
    </dialog>}
  </div>;
}
