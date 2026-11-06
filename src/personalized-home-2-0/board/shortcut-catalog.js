import { processedSiteIconFor } from '../../siteIcons';
// Names, destinations and category labels are preserved from the user-supplied
// 180清晰版/图标清单.json. Images are copied byte-for-byte; no external image requests.
const originalShortcutCatalog = [
  {
    "id": "domestic-001",
    "label": "百度",
    "url": "https://www.baidu.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-001.png",
    "region": "国内",
    "category": "搜索与 AI",
    "description": "baidu.com"
  },
  {
    "id": "domestic-002",
    "label": "Bing",
    "url": "https://www.bing.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-002.png",
    "region": "国内",
    "category": "搜索与 AI",
    "description": "bing.com"
  },
  {
    "id": "domestic-003",
    "label": "豆包",
    "url": "https://www.doubao.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-003.png",
    "region": "国内",
    "category": "搜索与 AI",
    "description": "doubao.com"
  },
  {
    "id": "domestic-004",
    "label": "DeepSeek",
    "url": "https://chat.deepseek.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-004.png",
    "region": "国内",
    "category": "搜索与 AI",
    "description": "chat.deepseek.com"
  },
  {
    "id": "domestic-005",
    "label": "Kimi",
    "url": "https://www.kimi.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-005.png",
    "region": "国内",
    "category": "搜索与 AI",
    "description": "kimi.com"
  },
  {
    "id": "domestic-006",
    "label": "千问",
    "url": "https://www.qianwen.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-006.png",
    "region": "国内",
    "category": "搜索与 AI",
    "description": "qianwen.com"
  },
  {
    "id": "domestic-007",
    "label": "小红书",
    "url": "https://www.xiaohongshu.com/explore",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-007.png",
    "region": "国内",
    "category": "社交与社区",
    "description": "xiaohongshu.com"
  },
  {
    "id": "domestic-008",
    "label": "知乎",
    "url": "https://www.zhihu.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-008.png",
    "region": "国内",
    "category": "社交与社区",
    "description": "zhihu.com"
  },
  {
    "id": "domestic-009",
    "label": "微博",
    "url": "https://weibo.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-009.png",
    "region": "国内",
    "category": "社交与社区",
    "description": "weibo.com"
  },
  {
    "id": "domestic-010",
    "label": "豆瓣",
    "url": "https://www.douban.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-010.png",
    "region": "国内",
    "category": "社交与社区",
    "description": "douban.com"
  },
  {
    "id": "domestic-011",
    "label": "百度贴吧",
    "url": "https://tieba.baidu.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-011.png",
    "region": "国内",
    "category": "社交与社区",
    "description": "tieba.baidu.com"
  },
  {
    "id": "domestic-012",
    "label": "即刻",
    "url": "https://web.okjike.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-012.png",
    "region": "国内",
    "category": "社交与社区",
    "description": "web.okjike.com"
  },
  {
    "id": "domestic-013",
    "label": "哔哩哔哩",
    "url": "https://www.bilibili.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-013.png",
    "region": "国内",
    "category": "视频与音乐",
    "description": "bilibili.com"
  },
  {
    "id": "domestic-014",
    "label": "抖音",
    "url": "https://www.douyin.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-014.png",
    "region": "国内",
    "category": "视频与音乐",
    "description": "douyin.com"
  },
  {
    "id": "domestic-015",
    "label": "腾讯视频",
    "url": "https://v.qq.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-015.png",
    "region": "国内",
    "category": "视频与音乐",
    "description": "v.qq.com"
  },
  {
    "id": "domestic-016",
    "label": "爱奇艺",
    "url": "https://www.iqiyi.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-016.png",
    "region": "国内",
    "category": "视频与音乐",
    "description": "iqiyi.com"
  },
  {
    "id": "domestic-017",
    "label": "优酷",
    "url": "https://www.youku.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-017.png",
    "region": "国内",
    "category": "视频与音乐",
    "description": "youku.com"
  },
  {
    "id": "domestic-018",
    "label": "芒果 TV",
    "url": "https://www.mgtv.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-018.png",
    "region": "国内",
    "category": "视频与音乐",
    "description": "mgtv.com"
  },
  {
    "id": "domestic-019",
    "label": "网易云音乐",
    "url": "https://music.163.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-019.png",
    "region": "国内",
    "category": "视频与音乐",
    "description": "music.163.com"
  },
  {
    "id": "domestic-020",
    "label": "QQ 音乐",
    "url": "https://y.qq.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-020.png",
    "region": "国内",
    "category": "视频与音乐",
    "description": "y.qq.com"
  },
  {
    "id": "domestic-021",
    "label": "QQ 邮箱",
    "url": "https://mail.qq.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-021.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "mail.qq.com"
  },
  {
    "id": "domestic-022",
    "label": "网易邮箱",
    "url": "https://mail.163.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-022.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "mail.163.com"
  },
  {
    "id": "domestic-023",
    "label": "飞书",
    "url": "https://www.feishu.cn/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-023.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "feishu.cn"
  },
  {
    "id": "domestic-024",
    "label": "腾讯文档",
    "url": "https://docs.qq.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-024.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "docs.qq.com"
  },
  {
    "id": "domestic-025",
    "label": "百度网盘",
    "url": "https://pan.baidu.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-025.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "pan.baidu.com"
  },
  {
    "id": "domestic-026",
    "label": "钉钉",
    "url": "https://www.dingtalk.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-026.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "dingtalk.com"
  },
  {
    "id": "domestic-027",
    "label": "金山文档",
    "url": "https://www.kdocs.cn/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-027.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "kdocs.cn"
  },
  {
    "id": "domestic-028",
    "label": "夸克网盘",
    "url": "https://pan.quark.cn/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-028.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "pan.quark.cn"
  },
  {
    "id": "domestic-029",
    "label": "语雀",
    "url": "https://www.yuque.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-029.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "yuque.com"
  },
  {
    "id": "domestic-030",
    "label": "FlowUs",
    "url": "https://flowus.cn/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-030.png",
    "region": "国内",
    "category": "邮箱、办公与网盘",
    "description": "flowus.cn"
  },
  {
    "id": "domestic-031",
    "label": "淘宝",
    "url": "https://www.taobao.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-031.png",
    "region": "国内",
    "category": "购物与消费",
    "description": "taobao.com"
  },
  {
    "id": "domestic-032",
    "label": "京东",
    "url": "https://www.jd.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-032.png",
    "region": "国内",
    "category": "购物与消费",
    "description": "jd.com"
  },
  {
    "id": "domestic-033",
    "label": "天猫",
    "url": "https://www.tmall.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-033.png",
    "region": "国内",
    "category": "购物与消费",
    "description": "tmall.com"
  },
  {
    "id": "domestic-034",
    "label": "拼多多",
    "url": "https://www.pinduoduo.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-034.png",
    "region": "国内",
    "category": "购物与消费",
    "description": "pinduoduo.com"
  },
  {
    "id": "domestic-035",
    "label": "闲鱼",
    "url": "https://www.goofish.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-035.png",
    "region": "国内",
    "category": "购物与消费",
    "description": "goofish.com"
  },
  {
    "id": "domestic-036",
    "label": "什么值得买",
    "url": "https://www.smzdm.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-036.png",
    "region": "国内",
    "category": "购物与消费",
    "description": "smzdm.com"
  },
  {
    "id": "domestic-037",
    "label": "腾讯新闻",
    "url": "https://news.qq.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-037.png",
    "region": "国内",
    "category": "新闻与财经",
    "description": "news.qq.com"
  },
  {
    "id": "domestic-038",
    "label": "网易新闻",
    "url": "https://www.163.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-038.png",
    "region": "国内",
    "category": "新闻与财经",
    "description": "163.com"
  },
  {
    "id": "domestic-039",
    "label": "今日头条",
    "url": "https://www.toutiao.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-039.png",
    "region": "国内",
    "category": "新闻与财经",
    "description": "toutiao.com"
  },
  {
    "id": "domestic-040",
    "label": "澎湃新闻",
    "url": "https://www.thepaper.cn/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-040.png",
    "region": "国内",
    "category": "新闻与财经",
    "description": "thepaper.cn"
  },
  {
    "id": "domestic-041",
    "label": "东方财富",
    "url": "https://www.eastmoney.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-041.png",
    "region": "国内",
    "category": "新闻与财经",
    "description": "eastmoney.com"
  },
  {
    "id": "domestic-042",
    "label": "雪球",
    "url": "https://xueqiu.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-042.png",
    "region": "国内",
    "category": "新闻与财经",
    "description": "xueqiu.com"
  },
  {
    "id": "domestic-043",
    "label": "微信读书",
    "url": "https://weread.qq.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-043.png",
    "region": "国内",
    "category": "学习与阅读",
    "description": "weread.qq.com"
  },
  {
    "id": "domestic-044",
    "label": "中国大学 MOOC",
    "url": "https://www.icourse163.org/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-044.png",
    "region": "国内",
    "category": "学习与阅读",
    "description": "icourse163.org"
  },
  {
    "id": "domestic-045",
    "label": "中国知网",
    "url": "https://www.cnki.net/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-045.png",
    "region": "国内",
    "category": "学习与阅读",
    "description": "cnki.net"
  },
  {
    "id": "domestic-046",
    "label": "百度文库",
    "url": "https://wenku.baidu.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-046.png",
    "region": "国内",
    "category": "学习与阅读",
    "description": "wenku.baidu.com"
  },
  {
    "id": "domestic-047",
    "label": "学堂在线",
    "url": "https://www.xuetangx.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-047.png",
    "region": "国内",
    "category": "学习与阅读",
    "description": "xuetangx.com"
  },
  {
    "id": "domestic-048",
    "label": "国家图书馆",
    "url": "https://www.nlc.cn/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-048.png",
    "region": "国内",
    "category": "学习与阅读",
    "description": "nlc.cn"
  },
  {
    "id": "domestic-049",
    "label": "GitHub",
    "url": "https://github.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-049.png",
    "region": "国内",
    "category": "开发与设计",
    "description": "github.com"
  },
  {
    "id": "domestic-050",
    "label": "掘金",
    "url": "https://juejin.cn/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-050.png",
    "region": "国内",
    "category": "开发与设计",
    "description": "juejin.cn"
  },
  {
    "id": "domestic-051",
    "label": "CSDN",
    "url": "https://www.csdn.net/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-051.png",
    "region": "国内",
    "category": "开发与设计",
    "description": "csdn.net"
  },
  {
    "id": "domestic-052",
    "label": "阿里云",
    "url": "https://www.aliyun.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-052.png",
    "region": "国内",
    "category": "开发与设计",
    "description": "aliyun.com"
  },
  {
    "id": "domestic-053",
    "label": "即时设计",
    "url": "https://js.design/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-053.png",
    "region": "国内",
    "category": "开发与设计",
    "description": "js.design"
  },
  {
    "id": "domestic-054",
    "label": "Canva 可画",
    "url": "https://www.canva.cn/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-054.png",
    "region": "国内",
    "category": "开发与设计",
    "description": "canva.cn"
  },
  {
    "id": "domestic-060",
    "label": "美团",
    "url": "https://www.meituan.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-060.png",
    "region": "国内",
    "category": "生活与出行",
    "description": "meituan.com"
  },
  {
    "id": "domestic-059",
    "label": "大众点评",
    "url": "https://www.dianping.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-059.png",
    "region": "国内",
    "category": "生活与出行",
    "description": "dianping.com"
  },
  {
    "id": "domestic-055",
    "label": "高德地图",
    "url": "https://www.amap.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-055.png",
    "region": "国内",
    "category": "生活与出行",
    "description": "amap.com"
  },
  {
    "id": "domestic-056",
    "label": "百度地图",
    "url": "https://map.baidu.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-056.png",
    "region": "国内",
    "category": "生活与出行",
    "description": "map.baidu.com"
  },
  {
    "id": "domestic-058",
    "label": "12306",
    "url": "https://www.12306.cn/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/domestic-058.png",
    "region": "国内",
    "category": "生活与出行",
    "description": "12306.cn"
  },
  {
    "id": "international-061",
    "label": "Google",
    "url": "https://www.google.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-061.png",
    "region": "国际",
    "category": "Search & AI",
    "description": "google.com"
  },
  {
    "id": "international-002",
    "label": "Bing",
    "url": "https://www.bing.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-002.png",
    "region": "国际",
    "category": "Search & AI",
    "description": "bing.com"
  },
  {
    "id": "international-062",
    "label": "DuckDuckGo",
    "url": "https://duckduckgo.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-062.png",
    "region": "国际",
    "category": "Search & AI",
    "description": "duckduckgo.com"
  },
  {
    "id": "international-063",
    "label": "ChatGPT",
    "url": "https://chatgpt.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-063.png",
    "region": "国际",
    "category": "Search & AI",
    "description": "chatgpt.com"
  },
  {
    "id": "international-064",
    "label": "Gemini",
    "url": "https://gemini.google.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-064.png",
    "region": "国际",
    "category": "Search & AI",
    "description": "gemini.google.com"
  },
  {
    "id": "international-065",
    "label": "Claude",
    "url": "https://claude.ai/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-065.png",
    "region": "国际",
    "category": "Search & AI",
    "description": "claude.ai"
  },
  {
    "id": "international-066",
    "label": "Perplexity",
    "url": "https://www.perplexity.ai/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-066.png",
    "region": "国际",
    "category": "Search & AI",
    "description": "perplexity.ai"
  },
  {
    "id": "international-067",
    "label": "Copilot",
    "url": "https://copilot.microsoft.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-067.png",
    "region": "国际",
    "category": "Search & AI",
    "description": "copilot.microsoft.com"
  },
  {
    "id": "international-068",
    "label": "Facebook",
    "url": "https://www.facebook.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-068.png",
    "region": "国际",
    "category": "Social & Messaging",
    "description": "facebook.com"
  },
  {
    "id": "international-069",
    "label": "Instagram",
    "url": "https://www.instagram.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-069.png",
    "region": "国际",
    "category": "Social & Messaging",
    "description": "instagram.com"
  },
  {
    "id": "international-070",
    "label": "Reddit",
    "url": "https://www.reddit.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-070.png",
    "region": "国际",
    "category": "Social & Messaging",
    "description": "reddit.com"
  },
  {
    "id": "international-071",
    "label": "WhatsApp",
    "url": "https://web.whatsapp.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-071.png",
    "region": "国际",
    "category": "Social & Messaging",
    "description": "web.whatsapp.com"
  },
  {
    "id": "international-072",
    "label": "X",
    "url": "https://x.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-072.png",
    "region": "国际",
    "category": "Social & Messaging",
    "description": "x.com"
  },
  {
    "id": "international-073",
    "label": "Discord",
    "url": "https://discord.com/app",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-073.png",
    "region": "国际",
    "category": "Social & Messaging",
    "description": "discord.com"
  },
  {
    "id": "international-074",
    "label": "Telegram",
    "url": "https://web.telegram.org/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-074.png",
    "region": "国际",
    "category": "Social & Messaging",
    "description": "web.telegram.org"
  },
  {
    "id": "international-075",
    "label": "LinkedIn",
    "url": "https://www.linkedin.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-075.png",
    "region": "国际",
    "category": "Social & Messaging",
    "description": "linkedin.com"
  },
  {
    "id": "international-076",
    "label": "YouTube",
    "url": "https://www.youtube.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-076.png",
    "region": "国际",
    "category": "Video, Music & Games",
    "description": "youtube.com"
  },
  {
    "id": "international-077",
    "label": "TikTok",
    "url": "https://www.tiktok.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-077.png",
    "region": "国际",
    "category": "Video, Music & Games",
    "description": "tiktok.com"
  },
  {
    "id": "international-078",
    "label": "Netflix",
    "url": "https://www.netflix.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-078.png",
    "region": "国际",
    "category": "Video, Music & Games",
    "description": "netflix.com"
  },
  {
    "id": "international-079",
    "label": "Spotify",
    "url": "https://open.spotify.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-079.png",
    "region": "国际",
    "category": "Video, Music & Games",
    "description": "open.spotify.com"
  },
  {
    "id": "international-080",
    "label": "Twitch",
    "url": "https://www.twitch.tv/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-080.png",
    "region": "国际",
    "category": "Video, Music & Games",
    "description": "twitch.tv"
  },
  {
    "id": "international-081",
    "label": "Steam",
    "url": "https://store.steampowered.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-081.png",
    "region": "国际",
    "category": "Video, Music & Games",
    "description": "store.steampowered.com"
  },
  {
    "id": "international-082",
    "label": "Gmail",
    "url": "https://mail.google.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-082.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "mail.google.com"
  },
  {
    "id": "international-083",
    "label": "Outlook",
    "url": "https://outlook.live.com/mail/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-083.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "outlook.live.com"
  },
  {
    "id": "international-084",
    "label": "Google Drive",
    "url": "https://drive.google.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-084.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "drive.google.com"
  },
  {
    "id": "international-085",
    "label": "Google Docs",
    "url": "https://docs.google.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-085.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "docs.google.com"
  },
  {
    "id": "international-086",
    "label": "Google Calendar",
    "url": "https://calendar.google.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-086.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "calendar.google.com"
  },
  {
    "id": "international-087",
    "label": "Notion",
    "url": "https://www.notion.so/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-087.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "notion.so"
  },
  {
    "id": "international-088",
    "label": "Microsoft 365",
    "url": "https://www.microsoft365.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-088.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "microsoft365.com"
  },
  {
    "id": "international-089",
    "label": "Slack",
    "url": "https://app.slack.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-089.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "app.slack.com"
  },
  {
    "id": "international-090",
    "label": "Zoom",
    "url": "https://app.zoom.us/wc",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-090.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "app.zoom.us"
  },
  {
    "id": "international-091",
    "label": "Dropbox",
    "url": "https://www.dropbox.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-091.png",
    "region": "国际",
    "category": "Mail, Work & Cloud",
    "description": "dropbox.com"
  },
  {
    "id": "international-092",
    "label": "Amazon",
    "url": "https://www.amazon.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-092.png",
    "region": "国际",
    "category": "Shopping & Travel",
    "description": "amazon.com"
  },
  {
    "id": "international-093",
    "label": "eBay",
    "url": "https://www.ebay.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-093.png",
    "region": "国际",
    "category": "Shopping & Travel",
    "description": "ebay.com"
  },
  {
    "id": "international-094",
    "label": "Etsy",
    "url": "https://www.etsy.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-094.png",
    "region": "国际",
    "category": "Shopping & Travel",
    "description": "etsy.com"
  },
  {
    "id": "international-095",
    "label": "Booking.com",
    "url": "https://www.booking.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-095.png",
    "region": "国际",
    "category": "Shopping & Travel",
    "description": "booking.com"
  },
  {
    "id": "international-096",
    "label": "Airbnb",
    "url": "https://www.airbnb.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-096.png",
    "region": "国际",
    "category": "Shopping & Travel",
    "description": "airbnb.com"
  },
  {
    "id": "international-097",
    "label": "Google Maps",
    "url": "https://maps.google.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-097.png",
    "region": "国际",
    "category": "Shopping & Travel",
    "description": "maps.google.com"
  },
  {
    "id": "international-098",
    "label": "BBC",
    "url": "https://www.bbc.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-098.png",
    "region": "国际",
    "category": "News & Information",
    "description": "bbc.com"
  },
  {
    "id": "international-099",
    "label": "Reuters",
    "url": "https://www.reuters.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-099.png",
    "region": "国际",
    "category": "News & Information",
    "description": "reuters.com"
  },
  {
    "id": "international-100",
    "label": "CNN",
    "url": "https://www.cnn.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-100.png",
    "region": "国际",
    "category": "News & Information",
    "description": "cnn.com"
  },
  {
    "id": "international-101",
    "label": "The Guardian",
    "url": "https://www.theguardian.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-101.png",
    "region": "国际",
    "category": "News & Information",
    "description": "theguardian.com"
  },
  {
    "id": "international-102",
    "label": "Yahoo Finance",
    "url": "https://finance.yahoo.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-102.png",
    "region": "国际",
    "category": "News & Information",
    "description": "finance.yahoo.com"
  },
  {
    "id": "international-103",
    "label": "Weather.com",
    "url": "https://weather.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-103.png",
    "region": "国际",
    "category": "News & Information",
    "description": "weather.com"
  },
  {
    "id": "international-104",
    "label": "Wikipedia",
    "url": "https://www.wikipedia.org/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-104.png",
    "region": "国际",
    "category": "Learning & Reference",
    "description": "wikipedia.org"
  },
  {
    "id": "international-105",
    "label": "Google Scholar",
    "url": "https://scholar.google.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-105.png",
    "region": "国际",
    "category": "Learning & Reference",
    "description": "scholar.google.com"
  },
  {
    "id": "international-106",
    "label": "Coursera",
    "url": "https://www.coursera.org/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-106.png",
    "region": "国际",
    "category": "Learning & Reference",
    "description": "coursera.org"
  },
  {
    "id": "international-107",
    "label": "Khan Academy",
    "url": "https://www.khanacademy.org/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-107.png",
    "region": "国际",
    "category": "Learning & Reference",
    "description": "khanacademy.org"
  },
  {
    "id": "international-108",
    "label": "Duolingo",
    "url": "https://www.duolingo.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-108.png",
    "region": "国际",
    "category": "Learning & Reference",
    "description": "duolingo.com"
  },
  {
    "id": "international-109",
    "label": "DeepL",
    "url": "https://www.deepl.com/translator",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-109.png",
    "region": "国际",
    "category": "Learning & Reference",
    "description": "deepl.com"
  },
  {
    "id": "international-049",
    "label": "GitHub",
    "url": "https://github.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-049.png",
    "region": "国际",
    "category": "Development & Design",
    "description": "github.com"
  },
  {
    "id": "international-110",
    "label": "Stack Overflow",
    "url": "https://stackoverflow.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-110.png",
    "region": "国际",
    "category": "Development & Design",
    "description": "stackoverflow.com"
  },
  {
    "id": "international-111",
    "label": "MDN",
    "url": "https://developer.mozilla.org/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-111.png",
    "region": "国际",
    "category": "Development & Design",
    "description": "developer.mozilla.org"
  },
  {
    "id": "international-112",
    "label": "Figma",
    "url": "https://www.figma.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-112.png",
    "region": "国际",
    "category": "Development & Design",
    "description": "figma.com"
  },
  {
    "id": "international-113",
    "label": "Canva",
    "url": "https://www.canva.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-113.png",
    "region": "国际",
    "category": "Development & Design",
    "description": "canva.com"
  },
  {
    "id": "international-114",
    "label": "Pinterest",
    "url": "https://www.pinterest.com/",
    "image": "/personalized-home-2-0/asset/shortcut-catalog/international-114.png",
    "region": "国际",
    "category": "Development & Design",
    "description": "pinterest.com"
  }
];

export const shortcutCatalog = originalShortcutCatalog.map(item => {
  const image = processedSiteIconFor(item.url);
  return image ? { ...item, image, darkImage: undefined } : item;
});

export const shortcutRegions = ['国内', '国际'];

export const shortcutCategories = Object.fromEntries(shortcutRegions.map(region => [
  region, [...new Set(shortcutCatalog.filter(item => item.region === region).map(item => item.category))],
]));
