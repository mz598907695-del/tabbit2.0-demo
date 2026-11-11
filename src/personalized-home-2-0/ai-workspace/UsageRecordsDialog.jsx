import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../icons';
import { getHomeRoot } from '../home-host';
import { UsageRecords } from './WorkspaceUsage';
import '../../DeleteSpaceDialog.css';

export default function UsageRecordsDialog({ onClose }) {
  const ref=useRef(null);
  useLayoutEffect(()=>{
    const dialog=ref.current, opener=document.activeElement;
    dialog.showModal();
    dialog.focus({preventScroll:true});
    return()=>{
      dialog.close();
      if(opener?.isConnected && !opener.closest('[inert]')) opener.focus?.({preventScroll:true});
    };
  },[]);
  return createPortal(<dialog ref={ref} tabIndex={-1} autoFocus className="delete-space-dialog aiwu-records-modal" aria-labelledby="aiwu-records-title" onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}} onKeyDown={event=>event.stopPropagation()} onClick={event=>{
    if(event.target!==event.currentTarget) return;
    const rect=event.currentTarget.getBoundingClientRect();
    if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) onClose();
  }}>
    <header className="aiwu-records-heading"><h2 id="aiwu-records-title">使用记录</h2><button type="button" className="aiwu-records-close" aria-label="关闭使用记录" onClick={onClose}><X size={16}/></button></header>
    <div className="aiwu-records-dialog"><UsageRecords showHeading={false}/></div>
  </dialog>,getHomeRoot());
}
