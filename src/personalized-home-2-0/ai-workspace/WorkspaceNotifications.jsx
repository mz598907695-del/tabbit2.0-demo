import { useState } from 'react';
import { Bell, CreditCard, Megaphone, MessageCircle } from 'lucide-react';
import { NOTIFICATION_TABS } from './notification-data';
import './workspace-notifications.css';

const TAB_ICONS={all:Bell,product:Megaphone,feedback:MessageCircle,billing:CreditCard};

export default function WorkspaceNotifications({ initialEntry }) {
  const [category,setCategory]=useState(()=>NOTIFICATION_TABS.some(([id])=>id===initialEntry)?initialEntry:'all');
  function tabKeyDown(event,index){
    const next=event.key==='ArrowRight'?(index+1)%NOTIFICATION_TABS.length:event.key==='ArrowLeft'?(index+NOTIFICATION_TABS.length-1)%NOTIFICATION_TABS.length:event.key==='Home'?0:event.key==='End'?NOTIFICATION_TABS.length-1:-1;
    if(next<0)return;
    event.preventDefault();setCategory(NOTIFICATION_TABS[next][0]);event.currentTarget.parentElement.children[next]?.focus();
  }
  return <>
    <header className="aiwn-toolbar">
      <h2>通知</h2>
      <div className="aiwn-tabs" role="tablist" aria-label="通知分类">
        {NOTIFICATION_TABS.map(([id,label],index)=>{const Icon=TAB_ICONS[id];return <button key={id} id={`aiwn-tab-${id}`} role="tab" aria-selected={category===id} aria-controls="aiwn-panel" tabIndex={category===id?0:-1} onClick={()=>setCategory(id)} onKeyDown={event=>tabKeyDown(event,index)}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>;})}
      </div>
    </header>
    <div id="aiwn-panel" className="aiwn-list is-empty" role="tabpanel" aria-labelledby={`aiwn-tab-${category}`}>
      <div className="aiwn-empty">
        <span className="aiwn-empty-icon" aria-hidden="true"/>
        <strong>目前一切平静</strong><p>新通知将显示在此处</p>
      </div>
    </div>
  </>;
}
