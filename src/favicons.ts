import { processedSiteIcons } from "./siteIcons";
import newTabIcon from "./assets/new-tab.svg";

const assets = import.meta.glob<string>("./assets/favicons/*.{ico,png,svg,webp}", {
  eager: true, import: "default", query: "?url",
});
const sites = Object.fromEntries(Object.entries(assets).map(([path, url]) => [path.split("/").pop()!.replace(/\.[^.]+$/, ""), url]));

export const tabSites: Record<string, string> = {
  ...Object.fromEntries(Object.keys(processedSiteIcons).map(key => [`home:${key}`, key])), 
  "brand:trickle": "trickle", "brand:claude": "claude",
  "social:purposetalent": "purposetalent", "social:x": "x",
  "cars:nio": "nio", "cars:onvo": "onvo", "notion-loose": "notion",
  "games:steam": "steam", "games:indie": "indie", "games:epic": "epic",
  "games:community": "phantom-blade-zero", "games:reviews": "where-winds-meet", "games:wishlist": "steam",
  "fun:douban": "douban", "fun:bilibili": "bilibili", "fun:youtube": "youtube",
  "fun:qq-music": "qq-music", "fun:music": "music", "fun:podcast": "podcast", "fun:movie": "douban",
  "fun:shows": "iqiyi", "fun:concert": "damai",
  "life:weekend": "mafengwo", "life:home": "home",
  "rest:music": "music", "rest:podcast": "podcast",
};

export const tabIconFor = (id: string) => processedSiteIcons[tabSites[id]] ?? sites[tabSites[id]] ?? newTabIcon;
export const siteIconFor = (site: string) => processedSiteIcons[site] ?? sites[site];

