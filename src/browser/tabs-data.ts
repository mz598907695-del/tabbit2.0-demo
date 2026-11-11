// Seed tab data and session layouts shared by horizontal/vertical navigation.
export const BRAND_GROUP_ID = "group:brand";
export const INTERNAL_TAB_EVENT = "tabbit-open-internal-tab";
export const BOOKMARKS_TAB_ID = "internal:bookmarks";
export const internalTabTitle = (id: string) => id === BOOKMARKS_TAB_ID ? "收藏管理" : undefined;
export const GROUP_DIVIDER_SPACE = 10.5;
export type DemoGroup = { label: string; color: string; expanded: boolean; tabs: { id: string; title: string }[] };
const DEMO_GROUPS: Record<string, DemoGroup> = {
  [BRAND_GROUP_ID]: { label: "重要工具！", color: "var(--color-orange-4)", expanded: false, tabs: [
    { id: "brand:trickle", title: "trickle" }, { id: "brand:claude", title: "Claude" },
  ] },
  "group:tools": { label: "社交媒体", color: "#00bfc9", expanded: false, tabs: [
    { id: "social:purposetalent", title: "purposetalent" }, { id: "social:x", title: "X.com" },
  ] },
  "group:learning": { label: "汽车", color: "#63be3c", expanded: false, tabs: [
    { id: "cars:nio", title: "蔚来 NIO" }, { id: "cars:onvo", title: "乐道汽车官方网站" },
  ] },
};
export const isTabGroup = (id: string) => id.startsWith("group:");
export type SpaceTabs = { groups: Record<string, DemoGroup>; loose: { id: string; title: string }[] };
export const sampleSpace = (space: number, groups: { label: string; color: string; tabs: DemoGroup["tabs"] }[], loose: DemoGroup["tabs"] = []): SpaceTabs => ({
  groups: Object.fromEntries(groups.map((group, index) => [`group:space${space}:${index}`, { ...group, expanded: false }])), loose,
});
export const SPACE_TABS: SpaceTabs[] = [
  { groups: DEMO_GROUPS, loose: [{ id: "notion-loose", title: "Notion" }, { id: "new", title: "New Tab" }] },
  sampleSpace(1, [], [
    {id:"games:steam",title:"Steam 游戏库"},
    {id:"games:indie",title:"独立游戏精选"},
    {id:"games:epic",title:"Epic Games"},
    {id:"games:community",title:"影之刃零"},
    {id:"games:reviews",title:"燕云十六声"},
    {id:"games:wishlist",title:"愿望清单"},
    {id:"home:notion",title:"Notion"},
    {id:"home:youtube",title:"YouTube"},
    {id:"home:deepl",title:"DeepL"},
    {id:"home:perplexity",title:"Perplexity"},
    {id:"home:netflix",title:"Netflix"},
    {id:"home:spotify",title:"Spotify"},
    {id:"home:google",title:"Google"},
    {id:"home:openai",title:"ChatGPT"},
    {id:"home:claude",title:"Claude"},
    {id:"home:dribbble",title:"Dribbble"},
    {id:"home:purposetalent",title:"purposetalent"},
    {id:"home:trickle",title:"trickle"},
    {id:"home:zoom",title:"Zoom"},
    {id:"home:canva",title:"Canva"},
    {id:"home:figma",title:"Figma"},
    {id:"home:nio",title:"蔚来 NIO"},
    {id:"home:qq-music",title:"QQ 音乐"},
    {id:"home:drive",title:"Google Drive"},
    {id:"home:x",title:"X.com"},
    {id:"home:threads",title:"Threads"},
    {id:"home:dji",title:"大疆 DJI"},
    {id:"home:douyin",title:"抖音"},
    {id:"home:messenger",title:"Messenger"},
    {id:"home:facebook",title:"Facebook"},
    {id:"home:pinterest",title:"Pinterest"},
    {id:"home:slack",title:"Slack"},
    {id:"home:github",title:"GitHub"},
    {id:"home:yang",title:"yang"},
    {id:"home:grok",title:"Grok"},
  ]),
  sampleSpace(2, [], [
    { id: "fun:qq-music", title: "QQ 音乐" },
    { id: "fun:bilibili", title: "哔哩哔哩" },
    { id: "fun:youtube", title: "YouTube" },
    { id: "fun:music", title: "网易云音乐" },
    { id: "fun:podcast", title: "小宇宙播客" },
    { id: "social:purposetalent", title: "purposetalent" },
    { id: "brand:trickle", title: "trickle" },
    { id: "notion-loose", title: "Notion" },
  ]),
  sampleSpace(3, [{ label: "生活清单", color: "#65b848", tabs: [{ id: "life:weekend", title: "周末去哪里" }, { id: "life:home", title: "居家灵感" }] }], [{ id: "notion-loose", title: "Notion" }]),
  sampleSpace(4, [], [{ id: "brand:claude", title: "Claude" }, { id: "notion-loose", title: "Notion" }]),
  sampleSpace(5, [
    { label: "设计收藏", color: "#f39833", tabs: [{ id: "brand:trickle", title: "trickle" }, { id: "social:purposetalent", title: "purposetalent" }] },
    { label: "随手记", color: "#00bfc9", tabs: [{ id: "notion-loose", title: "Notion" }] },
  ]),
  sampleSpace(6, [{ label: "放松一下", color: "#e6a326", tabs: [{ id: "rest:music", title: "网易云音乐" }, { id: "rest:podcast", title: "播客时光" }] }]),
  sampleSpace(7, [], [{ id: "notion-loose", title: "Notion" }, { id: "social:x", title: "X.com" }]),
  sampleSpace(8, [{ label: "看车计划", color: "#4b8ff7", tabs: [{ id: "cars:nio", title: "蔚来 NIO" }, { id: "cars:onvo", title: "乐道汽车官方网站" }] }], [{ id: "brand:claude", title: "Claude" }]),
];
export const spaceTabLayouts = new Map<number, { tabs: string[]; groups: Record<string, DemoGroup> }>();
export const initialSpaceTab = (_space: number) => "new";
export const initialSpaceTabs = (space: number) => {
  const seed = SPACE_TABS[space];
  return ["new", ...Object.keys(seed.groups), ...seed.loose.filter((tab) => tab.id !== "new").map((tab) => tab.id)];
};
