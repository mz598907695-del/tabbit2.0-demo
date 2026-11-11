import { Fragment } from 'react';
import WorkspaceListDivider from './WorkspaceListDivider';
import ReflectiveMembershipCard from './ReflectiveMembershipCard';
import './workspace-files.css';
import { ArrowUp, ArrowDown, Zap } from 'lucide-react';
import './workspace-usage.css';

const USAGE_ROWS = [
  { id:'check-in', time:'11/10 15:15', mode:'签到 / 每日签到', change:'+6%', gain:true, source:'签到奖励' },
  { id:'cloud-task', time:'11/10 15:15', mode:'云端任务', change:'−6%', gain:false, source:'云端任务' },
];
const ORDERS = [['TB202610230001', '2026/10/23'], ['TB202609230001', '2026/09/23']];

export default function WorkspaceUsage({ filter, onPlans, onPurchaseCoupons, onUsageRecords, wallpaper }) {
  if (filter === 'coupons') return <section className="aiwu-empty" aria-label="重置券空状态">
    <span className="aiwu-empty-icon" aria-hidden="true"/>
    <div className="aiwu-empty-copy"><h2>暂无重置券</h2><p>购买重置券，随时开启新的用量周期。</p></div>
    <button type="button" className="aiwu-button is-primary" onClick={onPurchaseCoupons}>购买重置券</button>
  </section>;
  if (filter === 'orders') return <section className="aiwu-section" aria-label="订单中心">
    <div className="aiwu-section-heading"><h2>订单记录</h2><span>共 {ORDERS.length} 笔订单</span></div>
    <div className="aiwu-table-scroll aiwf-table-scroll"><table className="aiwu-table"><thead><tr><th scope="col">订单编号</th><th scope="col">创建时间</th><th scope="col">内容</th><th scope="col">状态</th></tr><WorkspaceListDivider columns={4}/></thead><tbody>
      {ORDERS.map(([id,date],index) => <Fragment key={id}><tr><td className="aiwu-order-id">{id}</td><td>{date}</td><td>专业版月度会员</td><td><span className="aiwu-status">示例订单</span></td></tr>{index < ORDERS.length - 1 && <WorkspaceListDivider columns={4}/>}</Fragment>)}
    </tbody></table></div>
  </section>;
  return <div className="aiwu-membership-content">
    <ReflectiveMembershipCard className="aiwu-card aiwu-membership-card" wallpaper={wallpaper}>
      <div className="aiwu-membership-top">
        <div className="aiwu-plan-copy"><span className="aiwu-membership-logo" role="img" aria-label="Tabbit"/><h2>标准版</h2><p>标准方案，包含基础会员用量与会员能力</p></div>
      </div>
      <button className="aiwu-upgrade" onClick={onPlans}><Zap size={16} fill="currentColor" strokeWidth={0} aria-hidden="true"/>立即升级</button>
      <div className="aiwu-card-divider"/>
      <div className="aiwu-quota">
        <h3>本周剩余用量</h3>
        <div className="aiwu-quota-meta"><span>1天16小时后重置</span><strong>剩余 100%</strong></div>
        <div className="aiwu-progress" role="meter" aria-label="本周剩余用量" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}><span style={{ width:'100%' }}/></div>
      </div>
    </ReflectiveMembershipCard>
    <button type="button" className="aiwu-records-entry" onClick={onUsageRecords}>查看使用记录</button>

  </div>;
}

export function UsageRecords({ showHeading = true }) {
  return <section className="aiwu-section" aria-label="使用记录">
      {showHeading && <div className="aiwu-section-heading"><h2>当前周期的使用记录</h2></div>}
      <div className="aiwu-table-scroll aiwf-table-scroll"><table className="aiwu-table aiwu-usage-table">
        <colgroup><col className="aiwu-time-col"/><col/><col/><col/></colgroup>
        <thead><tr><th scope="col">时间</th><th scope="col">模式/来源</th><th scope="col">用量变化</th><th scope="col">会话 / 来源</th></tr><WorkspaceListDivider columns={4}/></thead>
        <tbody>{USAGE_ROWS.map((row,index) => {const Icon=row.gain?ArrowUp:ArrowDown;return <Fragment key={row.id}><tr><td>{row.time}</td><td>{row.mode}</td><td><span className={`aiwu-change${row.gain?' is-gain':''}`}><Icon size={16} aria-hidden="true"/>{row.change}</span></td><td>{row.source}</td></tr>{index < USAGE_ROWS.length - 1 && <WorkspaceListDivider columns={4}/>}</Fragment>;})}</tbody>
      </table></div>
    </section>;
}
