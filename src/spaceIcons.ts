// Original space artwork supplied in Desktop/download.
const files = import.meta.glob<string>("./assets/space-picker/*.{png,webp}", { eager: true, import: "default", query: "?url" });
const names = [
  "汉堡", "鸡腿", "月饼", "米饭", "薯条", "苹果",
  "猴子", "熊猫", "狗", "狐狸", "牛", "考拉",
  "眼睛", "机械臂", "18 禁", "控制器", "电池", "书本",
  "房子", "火山", "地球", "车", "飞机", "衣服",
  "足球", "台球", "西瓜", "游戏手柄", "指南针", "火苗",
  "写", "脑子", "盒子", "大拇指", "手", "调色板",
  "大便", "笑脸", "庆祝", "恶魔", "发烧", "酷",
  "仙人掌", "树", "花", "蘑菇", "盆栽", "三叶草",
];
export const spaceIconOptions = names.map((name) => ({ name, src: files[`./assets/space-picker/${name}.webp`] || files[`./assets/space-picker/${name}.png`] }));
export const spaceIconByName = Object.fromEntries(spaceIconOptions.map((icon) => [icon.name, icon.src]));

export function pickSpaceIcon(name: string) {
  const matches: [RegExp, string][] = [
    [/游戏|电竞|game|steam/i, "游戏手柄"], [/工作|办公|事业|work|office/i, "书本"],
    [/学习|阅读|读书|课程|study|learn/i, "书本"], [/设计|创意|灵感|design/i, "调色板"],
    [/音乐|歌|music/i, "控制器"], [/旅行|旅游|出行|travel/i, "飞机"],
    [/汽车|看车|car|nio/i, "车"], [/生活|家庭|家|life|home/i, "房子"],
    [/美食|吃|餐|food/i, "汉堡"], [/电影|影视|娱乐|movie/i, "眼睛"],
    [/运动|健身|体育|sport/i, "足球"], [/项目|计划|project/i, "盒子"],
    [/思考|研究|ai|think/i, "脑子"], [/社交|朋友|social/i, "笑脸"],
  ];
  const matched = matches.find(([rule]) => rule.test(name));
  if (matched) return spaceIconByName[matched[1]];
  const hash = Array.from(name).reduce((value, char) => (value * 31 + char.codePointAt(0)!) >>> 0, 0);
  return spaceIconOptions[hash % spaceIconOptions.length].src;
}
