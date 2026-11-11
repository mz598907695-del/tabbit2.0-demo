export const leisureWidgetCatalog = [
  {kind:'workday-countdown',title:'下班倒计时',description:'设置上班时间与时长，实时倒数到下班。',defaultConfig:{startTime:'09:30',workHours:8},defaultSize:{w:4,h:2}},
  {kind:'joke',title:'轻松一刻',description:'换一个轻松的想法，也可以写下自己的句子。',defaultConfig:{index:0,text:''},defaultSize:{w:3,h:2}},
  {kind:'image',title:'每日一图',description:'每天一幅自然风景，可刷新切换，随主题调整明暗。',defaultConfig:{caption:''},defaultSize:{w:3,h:3}},
];

export function normalizeJokeConfig(config = {}, count = 1) {
  const index = Number(config?.index), length = Math.max(1, Math.trunc(Number(count)) || 1);
  return {
    index: Number.isFinite(index) ? Math.abs(Math.trunc(index)) % length : 0,
    text: typeof config?.text === 'string' ? config.text.slice(0, 2000) : '',
  };
}

export function normalizePhotoConfig(config = {}) {
  const photo = config?.photo;
  return {
    photo: typeof photo === 'string' && photo.length <= 700000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) ? photo : '',
    caption: typeof config?.caption === 'string' ? config.caption.slice(0, 200) : '',
  };
}
