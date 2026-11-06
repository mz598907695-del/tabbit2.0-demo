import { tabSites } from "./favicons";

const siteAddresses: Record<string, string> = {
  trickle: "https://trickle.so/", claude: "https://claude.ai/",
  purposetalent: "https://www.purposetalent.xyz/", x: "https://x.com/",
  nio: "https://www.nio.cn/", onvo: "https://www.onvo.cn/", notion: "https://www.notion.so/",
  steam: "https://store.steampowered.com/", indie: "https://itch.io/", epic: "https://store.epicgames.com/",
  "phantom-blade-zero": "https://pbz.s-game.com/", "where-winds-meet": "https://www.yysls.cn/",
  douban: "https://movie.douban.com/", bilibili: "https://www.bilibili.com/", youtube: "https://www.youtube.com/",
  "qq-music": "https://y.qq.com/", music: "https://music.163.com/", podcast: "https://www.xiaoyuzhoufm.com/",
  iqiyi: "https://www.iqiyi.com/", damai: "https://www.damai.cn/",
  mafengwo: "https://www.mafengwo.cn/", home: "https://www.haohaozhu.com/",
};

export function tabAddressFor(id: string) {
  if (id.startsWith("group:")) return `tabbit://group/${encodeURIComponent(id.slice(6))}`;
  if (id === "games:wishlist") return "https://store.steampowered.com/wishlist/";
  return siteAddresses[tabSites[id]] ?? "";
}
