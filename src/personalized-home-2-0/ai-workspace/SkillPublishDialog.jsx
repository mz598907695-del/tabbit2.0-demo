import { useEffect, useRef, useState } from 'react';
import { X } from '../icons';
import { SKILL_CATEGORIES } from './workspace-skills';
import { publishSkill } from './skill-publication';

export function SkillDialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => { const target = document.activeElement; ref.current.showModal(); return () => { ref.current?.close(); if (target?.isConnected) target.focus({preventScroll:true}); }; }, []);
  return <dialog ref={ref} className={`aiw-content-dialog aiwsd-dialog ${wide ? 'aiw-dialog-wide' : ''}`} aria-label={title} onCancel={e => {e.preventDefault();onClose();}} onKeyDown={e => e.stopPropagation()}>
    <header className="aiw-dialog-heading"><h2>{title}</h2><button className="aiw-content-icon-button" aria-label={`关闭${title}`} onClick={onClose}><X size={18}/></button></header>{children}
  </dialog>;
}
export default function SkillPublishDialog({item,onClose,onSave}) {
  const previous = item.publication || {};
  const [visibility,setVisibility] = useState(previous.visibility || 'link');
  const [description,setDescription] = useState(previous.description || item.description || '');
  const [category,setCategory] = useState(previous.category || item.category || 'tools');
  const [examples,setExamples] = useState((previous.examples || []).join('\n'));
  const [cover,setCover] = useState(previous.cover || '');
  const [originality,setOriginality] = useState(previous.originality || false);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  async function upload(file) {
    setError(''); if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5*1024*1024) {setError('请选择 5 MB 以内的 PNG、JPG 或 WebP 图片。');return;}
    setLoading(true);
    const url=URL.createObjectURL(file);
    try {
      const image=new Image(); image.src=url; await image.decode();
      const scale=Math.min(1,640/image.width,400/image.height); const canvas=document.createElement('canvas'); canvas.width=Math.round(image.width*scale); canvas.height=Math.round(image.height*scale);
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const result=canvas.toDataURL('image/webp',.7);
      if(result.length>180000) throw new Error('图片内容较复杂，请换一张较小的封面。');
      setCover(result);
    } catch(e) {setError(e.message || '封面读取失败，请重试。');}
    finally {URL.revokeObjectURL(url);setLoading(false);}
  }
  function submit(e) {e.preventDefault(); try { const next=publishSkill(item,{visibility,description,category,examples:examples.split('\n').map(s=>s.trim()).filter(Boolean),cover,originality}); onSave(next); }catch(e){setError(e.message);}}
  return <SkillDialog title={previous.status==='published' ? '发布更新' : '发布妙招'} onClose={onClose} wide><form className="aiw-content-form" onSubmit={submit}>
    <fieldset className="aiwsd-options"><legend>可见范围</legend><label><input type="radio" name="skill-visibility" value="link" checked={visibility==='link'} onChange={()=>setVisibility('link')}/>通过链接查看</label><label><input type="radio" name="skill-visibility" value="plaza" checked={visibility==='plaza'} onChange={()=>setVisibility('plaza')}/>广场公开</label></fieldset>
    <label>公开简介<textarea aria-label="公开简介" rows={3} maxLength={2000} required value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <label>分类<select aria-label="发布分类" value={category} onChange={e=>setCategory(e.target.value)}>{SKILL_CATEGORIES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>示例问法<textarea aria-label="示例问法" rows={3} maxLength={5000} placeholder="每行一个示例，帮助别人开始使用" value={examples} onChange={e=>setExamples(e.target.value)}/></label>
    <label>封面<input type="file" aria-label="上传妙招封面" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files?.[0])}/></label>
    {loading && <p role="status">正在读取封面…</p>}{cover && <div className="aiwsd-cover-preview"><img src={cover} alt="待发布的妙招封面"/><button type="button" className="aiw-button" onClick={()=>setCover('')}>移除封面</button></div>}
    <label className="aiwsd-checkbox"><input type="checkbox" checked={originality} onChange={e=>setOriginality(e.target.checked)}/>我确认内容为原创，或已获得分享授权</label>
    <p className="aiw-form-note">此 Demo 的广场和下架状态保存在当前浏览器。链接携带本次公开内容，其他人需能访问同一 Demo 地址；下架无法撤回已复制的内容。</p>
    {error && <p className="aiw-form-error" role="alert">{error}</p>}
    <div className="aiw-dialog-actions"><button type="button" className="aiw-button" onClick={onClose}>取消</button><button className="aiw-button aiw-button-primary" disabled={loading}>{previous.status==='published' ? '发布更新' : '确认发布'}</button></div>
  </form></SkillDialog>;
}
