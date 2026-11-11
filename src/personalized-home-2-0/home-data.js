import { processedSiteIconFor } from '../siteIcons';
import notionIcon from '../assets/favicons/notion.ico';
import yangIcon from '../assets/favicons/yang.png';
import purposetalentIcon from '../assets/favicons/purposetalent.png';
import trickleIcon from '../assets/favicons/trickle.png';
import grokIcon from '../assets/favicons/grok.png';
import claudeIcon from '../assets/favicons/claude.ico';
import nioIcon from '../assets/favicons/nio.ico';
import onvoIcon from '../assets/favicons/onvo.ico';
export const asset = (name) => `/personalized-home-2-0/asset/icons/${name}.svg`;
const originalBrands = {
  notion: { image: notionIcon, url: "https://www.notion.so", service: "Notion" },
  yang: { image: yangIcon, url: "https://yang.design", service: "yang" },
  purposetalent: { image: purposetalentIcon, url: "https://www.purposetalent.xyz", service: "purposetalent" },
  trickle: { image: trickleIcon, url: "https://trickle.so", service: "trickle" },
  grok: { image: grokIcon, url: "https://grok.com", service: "Grok" },
  claude: { image: claudeIcon, url: "https://claude.ai", service: "Claude" },
  nio: { image: nioIcon, url: "https://www.nio.cn", service: "蔚来 NIO" },
  onvo: { image: onvoIcon, url: "https://www.onvo.cn", service: "乐道汽车" },
  dribbble: {
    image: asset("dribbble"),
    url: "https://dribbble.com",
    service: "Dribbble",
  },
  dji: {
    image: asset("dji"),
    url: "https://www.dji.com/cn",
    service: "大疆",
  },
  douyin: {
    image: asset("svg_05e92667"),
    darkImage: asset("douyin-dark"),
    url: "https://www.douyin.com",
    service: "抖音",
  },
  slack: {
    image: asset("svg_ac93e7f8"),
    url: "https://slack.com",
    service: "Slack",
  },
  youtube: {
    image: asset("svg_db4f876a"),
    darkImage: asset("youtube-dark"),
    url: "https://www.youtube.com",
    service: "YouTube",
  },
  green: {
    image: asset("svg_6f6e002e"),
    url: "https://dribbble.com",
    service: "Dribbble",
  },
  openai: {
    image: asset("svg_a13912b3"),
    url: "https://chatgpt.com",
    service: "ChatGPT",
  },
};
export const brands = Object.fromEntries(Object.entries(originalBrands).map(([key, brand]) => {
  const image = processedSiteIconFor(brand.url) || processedSiteIconFor(key);
  return [key, image ? { ...brand, image, darkImage: undefined } : brand];
}));
export const initialShortcutPages = [
  {
    name: "工作",
    items: [
      ["notion", "Notion"],
      ["yang", "yang"],
      ["purposetalent", "purposetalent"],
      ["trickle", "trickle"],
      ["grok", "Grok"],
      ["claude", "Claude"],
      ["nio", "蔚来 NIO"],
      ["onvo", "乐道汽车"],
    ],
  },
  {
    name: "常用",
    items: [], // The default board supplies two link rows and the complete widget catalog.
  },
  {
    name: "灵感",
    items: [],
  },
];
export const promotions = [
  {
    title: "默认使用 Tabbit",
    description: "设为默认浏览器，享受更佳体验，还可领取标准版会员。",
    action: "将 Tabbit 设为默认浏览器",
    inlineAction: "设为默认",
    image: "/personalized-home-2-0/asset/images/default-browser.png",
    alt: "紫色光影中的速度表",
    kind: "default-browser",
    dialogEyebrow: "更顺手的浏览，从这里开始",
    dialogNote: "网页交互演示，未修改系统默认浏览器或发放会员权益。",
  },
  {
    title: "邀好友领会员",
    description: "邀请新用户注册并完成对话，双方各得专业版会员",
    action: "去看看",
    inlineAction: "邀请好友",
    image: "/personalized-home-2-0/asset/images/gift.jpg",
    alt: "暖红色光影中的礼盒",
    kind: "invite",
    dialogEyebrow: "把好用的，分享给好友",
  },
  {
    title: "开学季，学生专属福利",
    description: "完成学生认证，免费领取 30 天专业版会员",
    action: "领取开学福利",
    inlineAction: "领取福利",
    image: "/personalized-home-2-0/asset/images/promotion-settings.jpg",
    alt: "紫色光影中的齿轮",
    kind: "promotion-preview",
    dialogEyebrow: "新学期，一起开启更多可能",
    dialogNote: "活动示例，未接入学生认证或会员领取服务。",
  },
];
