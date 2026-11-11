const make = (kind, title, description, defaultConfig = {}, defaultSize = { w: 2, h: 2 }) => ({ kind, title, description, defaultConfig, defaultSize });
export const coreWidgetCatalog = [
  make('clock','时钟','点阵时间与细刻度，随时查看不同时区。',{seconds:false},{w:3,h:3}),
  make('news','最新新闻','中新网与 ECNS 官方中英文新闻，可切换 GDELT 来源。',{}, {w:4,h:4}),
  make('codex-usage','AI 余量','手动记录 AI 额度，用点阵清楚掌握剩余用量。',{provider:'AI',usedPercent:null,resetDate:''},{w:3,h:3}),
  make('quote','每日一句','每天一段中英文寄语，也能写下自己的句子。',{index:0,text:'',author:''},{w:3,h:3}),
  make('calendar','日历','完整月历，直接切月，让每一天都有清晰的位置。',{monthOffset:0},{w:3,h:3}),
  make('countdown','倒计时','为值得期待的日子，留一个专属位置。',{event:'新的开始',targetDate:`${new Date().getFullYear()+1}-01-01`},{w:4,h:2}),
  make('weather','天气','搜索城市，查看实时天气与未来 12 小时温度。',{city:'北京',latitude:39.9042,longitude:116.4074},{w:4,h:2}),
  make('calculator','计算器','加减乘除与括号，随手完成计算。',{expression:'',result:'0'},{w:4,h:4}),
  make('pomodoro','番茄时钟','专注一段时间，再好好休息。',{minutes:25,remaining:1500,endAt:0},{w:4,h:4}),
  make('draw','抽签','写下备选项，让随机给你一点启发。',{options:['去散步','读几页书','整理桌面','喝一杯茶'],result:''},{w:3,h:3}),
  make('note','便签','留下灵感、想法和重要的小事。',{text:''},{w:3,h:3}),
  make('converter','单位换算','长度、重量和温度，即时换算。',{category:'length',value:'1',from:'m',to:'cm'},{w:4,h:3}),
  make('todo','待办','把要做的事记下来，一件件完成。',{tasks:[]},{w:4,h:3}),
  make('timetable','课程表','按星期安排课程，记住时间与地点。',{lessons:[]},{w:4,h:3}),
];
export function finite(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
export function bounded(value, min, max, fallback=min) { return Math.max(min,Math.min(max,finite(value,fallback))); }
export function safeText(value, fallback='') { return typeof value === 'string' ? value : fallback; }
export function safeList(value) { return Array.isArray(value) ? value.filter(v=>v&&typeof v==='object').slice(0,200) : []; }
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export const UNIT_GROUPS = {
  length:[['mm','毫米',.001],['cm','厘米',.01],['m','米',1],['km','千米',1000],['in','英寸',.0254],['ft','英尺',.3048]],
  weight:[['g','克',.001],['kg','千克',1],['lb','磅',.45359237]],
  temperature:[['c','摄氏度',1],['f','华氏度',1],['k','开尔文',1]],
};
export function convertUnit(value, category, from, to) {
  if(String(value).trim()==='')return null;
  const n=Number(value), units=UNIT_GROUPS[category];
  if(!Number.isFinite(n)||!units)return null;
  const a=units.find(x=>x[0]===from), b=units.find(x=>x[0]===to);
  if(!a||!b)return null;
  if(category==='temperature'){const c=from==='f'?(n-32)*5/9:from==='k'?n-273.15:n;return to==='f'?c*9/5+32:to==='k'?c+273.15:c;}
  return n*a[2]/b[2];
}
// A small arithmetic parser: no dynamic code execution and no property access.
export function calculateExpression(input) {
  const source=String(input).replaceAll('×','*').replaceAll('÷','/').replace(/\s/g,'');
  if(!source||source.length>180||/[^\d.+\-*/()%]/.test(source))throw new Error('请输入有效算式');
  const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]/g)||[];let i=0;
  function atom(){let n;if(tokens[i]==='+'){i++;return atom();}if(tokens[i]==='-'){i++;return -atom();}if(tokens[i]==='('){i++;n=sum();if(tokens[i++]!==')')throw new Error('括号不匹配');}else{const token=tokens[i++];if(!token||!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token))throw new Error('算式不完整');n=Number(token);}while(tokens[i]==='%'){i++;n/=100;}return n;}
  function product(){let n=atom();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],r=atom();if(op==='/'&&r===0)throw new Error('不能除以零');n=op==='*'?n*r:n/r;}return n;}
  function sum(){let n=product();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],r=product();n=op==='+'?n+r:n-r;}return n;}
  const n=sum();if(i!==tokens.length||!Number.isFinite(n))throw new Error('无法计算这个算式');return String(Number(n.toPrecision(12)));
}
export function weatherLabel(code){if(code===0)return '晴';if([1,2,3].includes(code))return '多云';if([45,48].includes(code))return '雾';if(code>=71&&code<=77)return '雪';if(code>=95)return '雷雨';return '雨';}
