import WorkspaceListDivider from './WorkspaceListDivider';
import React from 'react';
import { Pause, Start } from '../icons';
import './workspace-files.css';
import './workspace-tasks.css';
import WorkspaceActionButton from './WorkspaceActionButton';

const status = item => <span className={`aiwt-status ${item.type === 'active' ? 'is-active' : ''}`}>{item.type === 'active' ? '生效中' : '已暂停'}</span>;

export default function WorkspaceTasks({ items, query, onOpen, onUpdate }) {
  if (!items.length) return <div className="aiwt-empty"><span className="aiwt-empty-icon" aria-hidden="true"/><div className="aiwt-empty-copy"><h2>{query ? '没有找到相关任务' : '暂无定时任务'}</h2><p>{query ? '换个关键词，或者切换分类试试。' : '创建一个任务，安排下一次行动。'}</p></div></div>;
  return <div className="aiwt-results">
    {query && <p className="aiw-results-label" role="status">找到 {items.length} 项相关任务</p>}
    {<div className="aiwt-table-scroll aiwf-table-scroll"><table className="aiwt-table">
      <colgroup><col className="aiwt-col-name"/><col className="aiwt-col-schedule"/><col className="aiwt-col-next"/><col className="aiwt-col-status"/><col className="aiwt-col-action"/></colgroup>
      <thead><tr><th scope="col">名称</th><th scope="col">执行计划</th><th scope="col">下次执行</th><th scope="col">状态</th><th scope="col">操作</th></tr><WorkspaceListDivider columns={5}/></thead>
      <tbody>{items.map((item,index) => <React.Fragment key={item.id}><tr>
        <td><div className="aiwt-name"><div><button className="aiwt-title aiwf-list-title" onClick={() => onOpen(item)}>{item.title}</button><p className="aiwt-description">{item.description}</p></div></div></td>
        <td>{item.schedule}</td><td>{item.type === 'active' ? item.date : '—'}</td><td>{status(item)}</td>
        <td><WorkspaceActionButton title={item.type === 'active' ? '暂停任务' : '恢复任务'} aria-label={`${item.type === 'active' ? '暂停' : '恢复'} ${item.title}`} onClick={() => onUpdate({ ...item, type: item.type === 'active' ? 'paused' : 'active' })}>{item.type === 'active' ? <Pause size={16}/> : <Start size={16}/>}</WorkspaceActionButton></td>
      </tr>{index < items.length - 1 && <WorkspaceListDivider columns={5}/>}</React.Fragment>)}</tbody>
    </table></div>}
  </div>;
}
