import { processedSiteIcons } from '../../siteIcons';
import { shortcutCatalog } from './shortcut-catalog.js';
import { reflowBoardItems, firstVacancy } from './layout.js';

export const CURATED_SECOND_DESKTOP_VERSION = 9;
const additionalProvidedEntries = [
  {key:'purposetalent',label:'purposetalent',url:'https://www.purposetalent.xyz/'},
  {key:'nio',label:'蔚来 NIO',url:'https://www.nio.cn/'},
  {key:'threads',label:'Threads',url:'https://www.threads.net/'},
  {key:'messenger',label:'Messenger',url:'https://www.messenger.com/'},
  {key:'facebook',label:'Facebook',url:'https://www.facebook.com/'},
];

export function createCuratedSecondDesktop(page, brands, today = new Date()) {
  const positions = {};
  const items = [];
  function widget(key, kind, title, config, x, y, w, h) {
    const id = `curated-v1-${key}`;
    positions[id] = { x, y };
    const retained=page.items?.find(item=>item.type==='widget'&&item.kind===kind);
    items.push({ id, type: 'widget', kind, title:retained?.title||title, config:retained?.config||config, size: { w, h } });
  }
  function shortcut(key, label, brand, x, y, w = 1, h = 1) {
    const id = `curated-v1-${key}`;
    positions[id] = { x, y };
    items.push({ ...brand, id, type: 'shortcut', key, label, service: label, size: { w, h } });
  }
  const site = label => shortcutCatalog.find(entry => entry.label === label && entry.region === '国际');
  const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 12);
  const targetDate = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;
  widget('weather', 'weather', '今日天气', { city: '北京市', temperature: '23', condition: '晴' }, 0, 1, 4, 2);
  widget('quote', 'quote', '留一点灵感', { index: 0, text: '保持好奇，把想法慢慢变成作品。', author: 'MAKE SOMETHING GOOD' }, 4, 2, 4, 2);
  widget('countdown', 'countdown', '下一次出发', { event: '周末去看山', targetDate }, 8, 2, 4, 2);
  const links = [
    ['figma','Figma',site('Figma')], ['notion','Notion',brands.notion],
    ['trickle','trickle',brands.trickle], ['claude','Claude',brands.claude],
    ['openai','ChatGPT',brands.openai], ['perplexity','Perplexity',site('Perplexity')],
    ['github','GitHub',site('GitHub')], ['dribbble','Dribbble',brands.dribbble],
    ['canva','Canva',site('Canva')], ['pinterest','Pinterest',site('Pinterest')],
    ['drive','Google Drive',site('Google Drive')], ['google','Google',{image:processedSiteIcons['google'],url:'https://www.google.com/'}],
    ['slack','Slack',site('Slack')], ['zoom','Zoom',site('Zoom')],
    ['deepl','DeepL',site('DeepL')], ['dji','大疆 DJI',{image:processedSiteIcons['dji'],url:'https://www.dji.com/'}],
    ['spotify','Spotify',site('Spotify')], ['youtube','YouTube',site('YouTube')],
    ['netflix','Netflix',site('Netflix')], ['qq-music','QQ 音乐',{image:processedSiteIcons['qq-music'],url:'https://y.qq.com/'}],
    ['x','X.com',{image:processedSiteIcons['x'],url:'https://x.com/'}], ['douyin','抖音',{image:processedSiteIcons['douyin'],url:'https://www.douyin.com/'}],
    ['yang','yang',{image:processedSiteIcons['yang'],url:'https://yang.design/'}], ['grok','Grok',{image:processedSiteIcons['grok'],url:'https://grok.com/'}],
    ...additionalProvidedEntries.map(entry=>[entry.key,entry.label,{...entry,image:processedSiteIcons[entry.key]}]),
  ];
  const shortcutOrder = ['notion','figma','claude','openai','trickle','drive','google','yang','grok','purposetalent','dji','nio','github','canva','dribbble','pinterest','perplexity','deepl','slack','zoom','spotify','qq-music','youtube','netflix','douyin','x','threads','messenger','facebook'];
  links.sort((a,b)=>shortcutOrder.indexOf(a[0])-shortcutOrder.indexOf(b[0]));
  links.forEach(([key,label,brand])=>shortcut(key,label,brand,0,0));
  widget('landscape','image','给眼睛放个假',{caption:''},0,4,5,3);
  widget('reminder','reminder','今天，慢慢来',{text:'整理一组设计灵感\n做一件最重要的事'},5,4,4,3);
  widget('calendar','calendar','日历',{monthOffset:0},9,4,3,3);
  widget('workday','workday-countdown','下班倒计时',{startTime:'09:30',workHours:8},0,7,4,2);
  widget('news','news','今日资讯',{index:0},4,7,5,4);
  widget('draw','draw','今日灵感签',{index:0},9,7,3,4);
  widget('joke','joke','轻松一下',{text:'今天的代码没有报错，只是在认真思考。',index:0},0,9,4,2);
  // Fixed reading orders make the composition repeatable in both name modes.
  const compositionOrders = {
  "12": [
    "quote",
    "notion",
    "figma",
    "claude",
    "weather",
    "openai",
    "trickle",
    "landscape",
    "drive",
    "news",
    "google",
    "calendar",
    "yang",
    "grok",
    "purposetalent",
    "dji",
    "countdown",
    "nio",
    "github",
    "canva",
    "workday",
    "dribbble",
    "draw",
    "pinterest",
    "joke",
    "perplexity",
    "deepl",
    "slack",
    "reminder",
    "zoom",
    "spotify",
    "qq-music",
    "youtube",
    "netflix",
    "douyin",
    "x",
    "threads",
    "messenger",
    "facebook"
  ],
  "10": [
    "quote",
    "weather",
    "notion",
    "figma",
    "landscape",
    "claude",
    "calendar",
    "openai",
    "trickle",
    "drive",
    "google",
    "reminder",
    "yang",
    "grok",
    "workday",
    "purposetalent",
    "dji",
    "news",
    "nio",
    "github",
    "canva",
    "dribbble",
    "joke",
    "pinterest",
    "perplexity",
    "draw",
    "deepl",
    "slack",
    "zoom",
    "spotify",
    "countdown",
    "qq-music",
    "youtube",
    "netflix",
    "douyin",
    "x",
    "threads",
    "messenger",
    "facebook"
  ]
};
  const byId=new Map(items.map(item=>[item.id,item]));
  function compose(columns) {
    const ordered=compositionOrders[columns].map(key=>{
      const item=byId.get(`curated-v1-${key}`);
      return {
        ...item,
        w:columns===10&&item.type==='widget'?5:item.size.w,
        h:columns===10&&item.type==='widget'?(item.kind==='news'?4:['image','calendar','reminder'].includes(item.kind)?3:2):item.size.h,
      };
    });
    return Object.fromEntries(reflowBoardItems(ordered,columns).map(({id,x,y})=>[id,{x,y}]));
  }
  const twelve=compose(12),ten=compose(10);
  return {...page,layoutVersion:3,curatedLayoutVersion:9,items,
    layouts:{'gap:free:12':twelve,'gap:free:10':ten},
    layoutOrder:[...items].sort((a,b)=>twelve[a.id].y-twelve[b.id].y||twelve[a.id].x-twelve[b.id].x).map(item=>item.id)};
}

// Refresh just the seven old starter entries; preserve IDs and all saved geometry.
const providedStarterReplacements = {
  "docs": {
    "key": "google",
    "label": "Google",
    "url": "https://www.google.com/"
  },
  "wikipedia": {
    "key": "dji",
    "label": "大疆 DJI",
    "url": "https://www.dji.com/"
  },
  "steam": {
    "key": "qq-music",
    "label": "QQ 音乐",
    "url": "https://y.qq.com/"
  },
  "maps": {
    "key": "x",
    "label": "X.com",
    "url": "https://x.com/"
  },
  "airbnb": {
    "key": "douyin",
    "label": "抖音",
    "url": "https://www.douyin.com/"
  },
  "duolingo": {
    "key": "yang",
    "label": "yang",
    "url": "https://yang.design/"
  },
  "gcalendar": {
    "key": "grok",
    "label": "Grok",
    "url": "https://grok.com/"
  }
};
export function refreshProvidedSecondPageIcons(page) {
  const items=page.items.map(item=>{
    const replacement=providedStarterReplacements[item.key];
    if(item.type!=='shortcut'||item.id!==`curated-v1-${item.key}`||!replacement)return item;
    return {...item,...replacement,service:replacement.label,image:processedSiteIcons[replacement.key],darkImage:undefined,customIcon:undefined,iconHostname:undefined};
  });
  const missing=additionalProvidedEntries.filter(entry=>!items.some(item=>item.type==='shortcut'&&item.key===entry.key));
  if(!missing.length)return {...page,items};
  const additions=missing.map(entry=>({...entry,id:`curated-v1-${entry.key}`,type:'shortcut',service:entry.label,image:processedSiteIcons[entry.key],size:{w:1,h:1}}));
  const layouts={...page.layouts};
  for(const [key,positions] of Object.entries(layouts)) {
    const match=/^gap:free:(\d+)$/.exec(key);
    if(!match)continue;
    const columns=Number(match[1]);
    const tiles=items.map(item=>({
      id:item.id,...positions[item.id],
      w:page.curatedLayoutVersion===CURATED_SECOND_DESKTOP_VERSION&&columns===10&&item.type==='widget'?5:item.size.w,
      h:page.curatedLayoutVersion===CURATED_SECOND_DESKTOP_VERSION&&columns===10&&item.type==='widget'?(item.kind==='news'?4:['image','calendar','reminder'].includes(item.kind)?3:2):item.size.h,
    }));
    const next={...positions};
    for(const item of additions){
      const point=firstVacancy(tiles,1,1,columns);
      next[item.id]=point;tiles.push({id:item.id,...point,w:1,h:1});
    }
    layouts[key]=next;
  }
  return {...page,items:[...items,...additions],layouts,layoutOrder:[...(page.layoutOrder||items.map(item=>item.id)),...additions.map(item=>item.id)]};
}
