import React from 'react';
import { MessageCircle, OutputGlobe, Pause, Share2, Start } from '../icons';
import WorkspaceActionButton from './WorkspaceActionButton';
import WorkspaceListDivider from './WorkspaceListDivider';
import './workspace-shares.css';

const TYPE_LABELS = { web:'网页', chat:'对话' };

export default function WorkspaceShares({ items, query, onOpen, onUpdate }) {
  if (!items.length) return <div className="aiwsh-empty"><Share2 size={32}/><h2>{query ? '没有找到相关分享' : '暂无分享内容'}</h2><p>{query ? '换个关键词，或者切换分类试试。' : '分享网页或对话后，可以在这里统一管理。'}</p></div>;
  return <div className="aiwsh-results">
    {query && <p className="aiw-results-label" role="status">找到 {items.length} 项相关分享</p>}
    <div className="aiwsh-table-scroll aiwf-table-scroll"><table className="aiwsh-table">
      <colgroup><col className="aiwsh-col-content"/><col className="aiwsh-col-type"/><col className="aiwsh-col-views"/><col className="aiwsh-col-status"/><col className="aiwsh-col-action"/></colgroup>
      <thead><tr><th scope="col">分享内容</th><th scope="col">类型</th><th scope="col">浏览量</th><th scope="col">状态</th><th scope="col">操作</th></tr><WorkspaceListDivider columns={5}/></thead>
      <tbody>{items.map((item,index) => {
        const Icon = item.type === 'web' ? OutputGlobe : MessageCircle;
        return <React.Fragment key={item.id}><tr>
          <td><div className="aiwsh-name"><span className="aiwsh-icon"><Icon size={16}/></span><div><button className="aiwsh-title aiwf-list-title" onClick={() => onOpen(item)}>{item.title}</button><p>{item.description}<span aria-hidden="true"> · </span>{item.date}</p></div></div></td>
          <td>{TYPE_LABELS[item.type] || item.type}</td>
          <td>{item.views} 次</td>
          <td><span className={`aiwsh-status${item.enabled ? ' is-active' : ''}`}>{item.enabled ? '已启用' : '已停用'}</span></td>
          <td><WorkspaceActionButton title={item.enabled ? '停用链接' : '启用链接'} aria-label={`${item.enabled ? '停用' : '启用'} ${item.title}`} onClick={() => onUpdate({ ...item, enabled:!item.enabled })}>{item.enabled ? <Pause size={16}/> : <Start size={16}/>}</WorkspaceActionButton></td>
        </tr>{index < items.length - 1 && <WorkspaceListDivider columns={5}/>}</React.Fragment>;
      })}</tbody>
    </table></div>
  </div>;
}
