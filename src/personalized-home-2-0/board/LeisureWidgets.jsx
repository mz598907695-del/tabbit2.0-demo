import { Clock, Smile } from 'lucide-react';
import { WidgetShell, WidgetButton, Field, DotMatrixNumber, DotGrid, useWidgetNow } from './UnifiedWidgetKit';
import { getWorkdayCountdown, normalizeWorkdayConfig, splitCountdown } from './utility-widget-data';
import { normalizeJokeConfig } from './leisure-widget-data';
import { DailyPictureWidget } from './DailyPictureWidget';
import './leisure-widgets.css';

const LINES = [
 ['今天的代码没有报错，只是在认真思考。','The code isn’t broken. It’s thinking deeply.'],
 ['人生就像打开的标签页，偶尔也需要整理一下。','Life is like open tabs. A little tidying helps.'],
 ['今天的计划：把“等一下”变成“做完了”。','Today’s plan: turn “in a minute” into “done”.'],
 ['如果灵感没来，先去喝杯水。','If inspiration is late, have a glass of water.'],
 ['休息不是暂停进步，是在悄悄充电。','Rest is progress with the screen off.'],
];
function Workday({config,onChange,preview,active,locale}) {
 const en=locale==='en-US',settings=normalizeWorkdayConfig(config), now=useWidgetNow(active&&!preview), countdown=getWorkdayCountdown(now,settings), parts=splitCountdown(countdown.remainingSeconds);
 const elapsed=Math.min(1,Math.max(0,(now-countdown.start)/(countdown.end-countdown.start)));
 const status=en?{working:'Until the day is yours',finished:'Enjoy your time',upcoming:'Your day starts soon'}:{working:'再忙，也记得好好休息',finished:'辛苦了，享受自己的时间',upcoming:'新的一天，慢慢开始'};
 const end=countdown.end.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',hour12:false});
 return <WidgetShell className="lw-workday" title={en?'End of workday':'下班倒计时'} icon={<Clock/>} preview={preview} footer={<span className="lw-footer"><span>{status[countdown.status]}</span><span>{en?'Finish':'下班'} {end}</span></span>} details={<div className="uw-stack"><section className="uw-detail-summary"><DotMatrixNumber value={parts.join(':')}/><p className="uw-muted">{status[countdown.status]}</p></section><section className="uw-detail-section"><h3>{en?'Your workday':'工作时间'}</h3><div className="uw-grid"><Field label={en?'Start time':'上班时间'}><input type="time" value={settings.startTime} onChange={e=>onChange?.({startTime:e.target.value})}/></Field><Field label={en?'Work hours':'工作时长（小时）'}><input type="number" min="1" max="16" step="0.5" value={settings.workHours} onChange={e=>onChange?.({workHours:Number(e.target.value)})}/></Field></div><p className="uw-muted">{en?'Calculated from your local clock. Overnight shifts are supported.':'按本地时间计算，支持跨午夜班次。'}</p></section></div>}>
  <div className="lw-workday-time"><DotMatrixNumber value={parts.slice(0,2).join(':')} label={en?`${parts[0]} hours ${parts[1]} minutes ${parts[2]} seconds`:`${parts[0]}小时${parts[1]}分${parts[2]}秒`}/><span className="lw-time-compact">{parts[0]}:<wbr/>{parts[1]}</span><span className="lw-workday-seconds" aria-hidden="true"><b>{parts[2]}</b><span>{en?'sec':'秒'}</span></span></div>
  <div className="lw-shift-progress"><div className="lw-shift-label"><span>{en?'Today’s progress':'今日进度'}</span><span>{Math.round(elapsed*100)}%</span></div><DotGrid value={elapsed*100} columns={24} rows={1} label={en?`Workday ${Math.round(elapsed*100)}% complete`:`今日工作已过 ${Math.round(elapsed*100)}%`}/></div>
 </WidgetShell>;
}
function Joke({config,onChange,preview,locale}) {
 const en=locale==='en-US',settings=normalizeJokeConfig(config,LINES.length),index=settings.index,text=settings.text.trim()||LINES[index][en?1:0];
 const next=()=>onChange?.({index:(index+1)%LINES.length,text:''});
 const artwork=<img className="lw-smile-art" src="/personalized-home-2-0/asset/widgets/editorial/quiet-smile.png" alt="" loading="lazy" decoding="async" draggable="false"/>;
 return <WidgetShell className="lw-joke" title={en?'A little smile':'轻松一刻'} icon={<Smile/>} preview={preview} footer={<WidgetButton disabled={preview} onClick={next}>{en?'One more':'换一句'} ↻</WidgetButton>} details={<div className="uw-stack"><section className="uw-detail-summary lw-joke-detail">{artwork}<blockquote>{text}</blockquote><WidgetButton onClick={next}>{en?'One more':'换一句'} ↻</WidgetButton></section><section className="uw-detail-section"><Field label={en?'Your own words':'写下自己的趣味文案'}><textarea value={settings.text} placeholder={en?'A thought to brighten the day':'给自己留一句轻松的话'} maxLength={2000} onChange={e=>onChange?.({text:e.target.value})}/></Field><p className="uw-detail-caption">{en?'Saved as you type. Leave blank to use the daily collection.':'输入自动保存，留空时使用内置文案。'}</p></section></div>}>{artwork}<p className="lw-joke-copy">{text}</p></WidgetShell>;
}
export function LeisureWidgetContent(props) { const Component={'workday-countdown':Workday,joke:Joke,image:DailyPictureWidget}[props.kind];return Component?<Component {...props}/>:null; }
