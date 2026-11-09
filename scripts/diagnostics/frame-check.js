/** Execute a dev-only renderer check in its own document/storage/CSS scope. */
export async function runIsolatedCheck(moduleUrl, exportName) {
  if (!/^\/scripts\/diagnostics\/[a-z-]+\.(js|jsx)$/.test(moduleUrl) || !/^[A-Za-z]+$/.test(exportName)) throw new Error('Invalid diagnostic');
  const frame=document.createElement('iframe');
  frame.style.cssText='position:fixed;inset:0;width:1100px;height:760px;opacity:0;pointer-events:none';
  frame.inert=true;
  const token=crypto.randomUUID();
  let receive,timer;
  try {
    const result=new Promise((resolve,reject)=>{
      receive=event=>{
        if(event.source!==frame.contentWindow||event.data?.token!==token)return;
        if(event.data.error)reject(new Error(event.data.error));else resolve(event.data.result);
      };
      window.addEventListener('message',receive);
      timer=setTimeout(()=>reject(new Error('Desktop diagnostic timed out')),45000);
    });
    frame.srcdoc=`<!doctype html><body style="margin:0"><script type="module">
      import '/@vite/client';
      import '/src/styles/tokens.css';
      import '/src/styles/semantic.css';
      import '/src/App.css';
      import '/src/personalized-home-2-0/styles.css';
      import '/src/personalized-home-2-0/styles/home-surfaces.css';
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;
      window.__vite_plugin_react_preamble_installed__=true;
      const storage=new Map();
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key),key:index=>[...storage.keys()][index]??null,get length(){return storage.size;}}});
      try{const checks=await import('${moduleUrl}');parent.postMessage({token:'${token}',result:await checks['${exportName}']()},'*');}
      catch(error){parent.postMessage({token:'${token}',error:String(error)},'*');}
    </script>`;
    document.body.append(frame);
    return await result;
  } finally {
    clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();
  }
}
