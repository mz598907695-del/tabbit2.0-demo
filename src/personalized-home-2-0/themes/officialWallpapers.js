import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';

// Curated from wallpapers previously shown in 我的. Existing IDs keep saved space themes intact.
const base = '/personalized-home-2-0/asset/wallpapers/official';
// A replacement keeps its theme ID while refreshing full images and previews.
const wallpaper = (id, name, category, file, mimeType = file.endsWith('.webp') ? 'image/webp' : 'image/jpeg', revision = '', weather = null) => {
  const version = revision ? `?v=${revision}` : '';
  const preview = `${base}/previews/${file.replace(/\.[^.]+$/, '.webp')}${version}`;
  return {
    id, name, category, url:`${base}/${file}${version}`, mimeType,
    preview,
    ...(mimeType.startsWith('video/') ? { posterUrl:preview } : {}),
    ...(weather ? { weather } : {}),
  };
};

// Stable IDs and asset locations keep saved spaces valid across gallery categories.
const bundledWallpapers = [
  wallpaper("wallpaper-f1214a36-d1e4-464c-b76e-2e911b7850f5", "碧海潮汐", "自然风景", "wallpaper-f1214a36-d1e4-464c-b76e-2e911b7850f5.mp4", "video/mp4", "b8de6c47b6d3"),
  wallpaper("wallpaper-ebfd6d00-b4a3-4683-8904-0455ed34f23d", "流光少女", "人物肖像", "wallpaper-ebfd6d00-b4a3-4683-8904-0455ed34f23d.mp4", "video/mp4", "d4a0e0b43b40"),
  wallpaper("wallpaper-d7c1327b-5768-4120-baec-5bbe58778a61", "流光少年", "人物肖像", "wallpaper-d7c1327b-5768-4120-baec-5bbe58778a61.mp4", "video/mp4", "dd94b7c0b1e3"),
  wallpaper("wallpaper-e4078eca-33d0-4eae-950f-6e0f239a48a1", "花影微光", "自然风景", "wallpaper-e4078eca-33d0-4eae-950f-6e0f239a48a1.mp4", "video/mp4", "b31e953d0d1e"),
  wallpaper("wallpaper-8bf04438-e011-40ed-80ff-b5e9e6e4ba8f", "晨光草甸", "自然风景", "wallpaper-8bf04438-e011-40ed-80ff-b5e9e6e4ba8f.mp4", "video/mp4", "0c7b2ab9de60"),
  wallpaper("wallpaper-12d03c16-5b1a-4480-8803-00afe56b6d18", "落日街角", "城市街景", "wallpaper-12d03c16-5b1a-4480-8803-00afe56b6d18.mp4", "video/mp4", "8c9e9251c0b7"),
  wallpaper("wallpaper-335e69d7-7f96-497a-8328-df1397dd0d57", "夜雨街角", "城市街景", "wallpaper-335e69d7-7f96-497a-8328-df1397dd0d57.mp4", "video/mp4", "b24a8d613864", "rain"),
  wallpaper("wallpaper-0df7b01b-dc20-4234-a074-2c660b13ee5b", "暮雪街角", "城市街景", "wallpaper-0df7b01b-dc20-4234-a074-2c660b13ee5b.mp4", "video/mp4", "a712096bfd80", "snow"),
  { ...wallpaper("wallpaper-c0ba91ff-e37a-4646-b6ba-ff6eef308909", "疾风街角", "城市街景", "wallpaper-c0ba91ff-e37a-4646-b6ba-ff6eef308909.mp4", "video/mp4", "75922fbdcaab"), brandMotion:'wind' },
  wallpaper("wallpaper-d60fa6ca-945e-42a8-bbd1-8f73298b37e0", "珠光新视", "艺术再造", "wallpaper-d60fa6ca-945e-42a8-bbd1-8f73298b37e0.mp4", "video/mp4", "b41b8bca4974"),
  wallpaper("wallpaper-7ce1ca01-47cc-41a1-ad3a-9c5090e655c3", "微笑新纪", "艺术再造", "wallpaper-7ce1ca01-47cc-41a1-ad3a-9c5090e655c3.mp4", "video/mp4", "f95fbd7aef25"),
  wallpaper("wallpaper-153798ec-ac60-4000-bd1a-70a9467233d9", "橙境少女", "人物肖像", "wallpaper-153798ec-ac60-4000-bd1a-70a9467233d9.webp", "image/webp"),
  wallpaper("wallpaper-44aa32a3-dbb4-4ccc-9dd4-6ed289278716", "橙境少年", "人物肖像", "wallpaper-44aa32a3-dbb4-4ccc-9dd4-6ed289278716.webp", "image/webp"),
  wallpaper("wallpaper-492a873c-f9f9-40f0-b170-72a78436b390", "赤星黎明", "宇宙星空", "wallpaper-492a873c-f9f9-40f0-b170-72a78436b390.webp"),
  wallpaper("wallpaper-71a99cfa-b837-41c7-b25f-6b06df632529", "蔚蓝曙光", "宇宙星空", "wallpaper-71a99cfa-b837-41c7-b25f-6b06df632529.webp"),
  wallpaper("wallpaper-81240eca-be1f-40ed-91fb-db894d1d69da", "星际信标", "宇宙星空", "wallpaper-81240eca-be1f-40ed-91fb-db894d1d69da.webp", "image/webp"),
  wallpaper("wallpaper-4e5b58b9-4704-4d45-b62f-cd6c7b703946", "暗夜微光", "抽象光影", "wallpaper-4e5b58b9-4704-4d45-b62f-cd6c7b703946.webp"),
  wallpaper("wallpaper-b5768511-c446-4fe5-902f-54b517a922e7", "玄黑流光", "抽象光影", "wallpaper-b5768511-c446-4fe5-902f-54b517a922e7.webp"),
  wallpaper("wallpaper-42051f26-79a1-4126-a648-126a3de5e0bb", "翡翠光波", "抽象光影", "wallpaper-42051f26-79a1-4126-a648-126a3de5e0bb.webp"),
  wallpaper("wallpaper-7a25b4d0-0cb6-4e43-a700-5690acfd4508", "深蓝丝流", "抽象光影", "wallpaper-7a25b4d0-0cb6-4e43-a700-5690acfd4508.webp", "image/webp"),
  wallpaper("wallpaper-78b4ff74-ee45-4f03-83d4-935f04879b47", "熔金回环", "抽象光影", "wallpaper-78b4ff74-ee45-4f03-83d4-935f04879b47.webp"),
  wallpaper("wallpaper-db1431d6-d55f-4637-8c1b-dc0f44576b0a", "钴蓝回环", "抽象光影", "wallpaper-db1431d6-d55f-4637-8c1b-dc0f44576b0a.webp"),
  wallpaper("wallpaper-69fe63dc-e1bc-41dc-900f-89275397be26", "熔金暮弧", "抽象光影", "wallpaper-69fe63dc-e1bc-41dc-900f-89275397be26.webp"),
  wallpaper("wallpaper-26afb3f6-45b8-40f5-bbb1-ce6a843fe6a2", "日照山巅", "自然风景", "wallpaper-26afb3f6-45b8-40f5-bbb1-ce6a843fe6a2.jpg"),
  wallpaper("wallpaper-631eb344-d546-4d85-8dad-c6ca35580c31", "旷野浮石", "品牌意象", "wallpaper-631eb344-d546-4d85-8dad-c6ca35580c31.jpg"),
  wallpaper("wallpaper-478de1bd-4d92-41c8-bd64-72bd976ab3f9", "金穗海岬", "自然风景", "wallpaper-478de1bd-4d92-41c8-bd64-72bd976ab3f9.jpg"),
  wallpaper("wallpaper-71e830d1-94f5-402a-b8c4-8cf06cfc3cb9", "流金沙丘", "自然风景", "wallpaper-71e830d1-94f5-402a-b8c4-8cf06cfc3cb9.webp"),
  wallpaper("wallpaper-332d88d4-0459-4e8b-a343-5f0035eb03ab", "向暮而行", "自然风景", "wallpaper-332d88d4-0459-4e8b-a343-5f0035eb03ab.jpg"),
  wallpaper("wallpaper-e9ebdc5c-ec5b-4d87-b916-b1ad69fc2c0a", "幽蓝潮汐", "自然风景", "wallpaper-e9ebdc5c-ec5b-4d87-b916-b1ad69fc2c0a.jpg"),
  wallpaper("wallpaper-b52d186e-e328-4379-b715-37eb122c3dca", "冰湾孤舟", "自然风景", "wallpaper-b52d186e-e328-4379-b715-37eb122c3dca.webp", "image/webp"),
  wallpaper("wallpaper-040c4db9-37e5-4f0f-a6ff-d5fbe51fb3e9", "暖丘独树", "自然风景", "wallpaper-040c4db9-37e5-4f0f-a6ff-d5fbe51fb3e9.jpg"),
  wallpaper("wallpaper-0af445ba-2bf4-4a34-886a-62aed9879bef", "赤沙雪岭", "自然风景", "wallpaper-0af445ba-2bf4-4a34-886a-62aed9879bef.webp"),
  wallpaper("wallpaper-8c6413cf-e932-4f4d-940e-924d8600c484", "粉霞雪峰", "自然风景", "wallpaper-8c6413cf-e932-4f4d-940e-924d8600c484.jpg"),
  wallpaper("wallpaper-914b554f-53e8-40d6-ae8f-0d4576db336a", "云上雪峰", "自然风景", "wallpaper-914b554f-53e8-40d6-ae8f-0d4576db336a.webp"),
  wallpaper("wallpaper-01a67213-86df-4270-abef-f0fe521671c9", "雪域印记", "品牌意象", "wallpaper-01a67213-86df-4270-abef-f0fe521671c9.jpg"),
  wallpaper("wallpaper-e3a448d2-084d-4724-a6ee-6b21a9440f1e", "绿雾遗迹", "巨石遗迹", "wallpaper-e3a448d2-084d-4724-a6ee-6b21a9440f1e.jpg"),
  wallpaper("wallpaper-9402e2a8-2e52-409c-a48e-0459a96876e4", "青原遗迹", "巨石遗迹", "wallpaper-9402e2a8-2e52-409c-a48e-0459a96876e4.jpg"),
  wallpaper("wallpaper-fff99ed7-a448-4379-aa98-1bc0e0cbffa1", "金沙遗迹", "巨石遗迹", "wallpaper-fff99ed7-a448-4379-aa98-1bc0e0cbffa1.jpg"),
  wallpaper("wallpaper-1536accc-25cb-4533-9894-029700d2731e", "霜蓝遗迹", "巨石遗迹", "wallpaper-1536accc-25cb-4533-9894-029700d2731e.jpg"),
  wallpaper("wallpaper-ada8a9d4-5749-4e74-b359-bca9a6a68551", "花海来信", "品牌意象", "wallpaper-ada8a9d4-5749-4e74-b359-bca9a6a68551.webp", "image/webp", "7ce008fc3c0f"),
  wallpaper("wallpaper-04aa9988-7d83-4863-9cc5-2fa5af1412b3", "蓝调霓虹", "品牌意象", "wallpaper-04aa9988-7d83-4863-9cc5-2fa5af1412b3.webp", "image/webp"),
  wallpaper("wallpaper-dc3f84cd-17b1-4367-b246-022427e68fe0", "烈焰字迹", "品牌意象", "wallpaper-dc3f84cd-17b1-4367-b246-022427e68fe0.jpg"),
];

// Official gallery order follows the curated selection; remaining bundled themes
// stay available in Community without changing their IDs or media paths.
const officialNames = ['花影微光', '晨光草甸', '珠光新视', '微笑新纪', '流金沙丘', '云上雪峰', '花海来信', '碧海潮汐', '玄黑流光', '深蓝丝流'];
export const officialWallpapers = officialNames.map(name => bundledWallpapers.find(item => item.name === name));
export const communityWallpapers = bundledWallpapers.filter(item => !officialNames.includes(item.name));
const communityWallpaperIds = new Set(communityWallpapers.map(item => item.id));
export const isCommunityWallpaperTheme = id => communityWallpaperIds.has(id);

// Saved spaces can still resolve retired themes; they are absent from the gallery.
export const retiredOfficialWallpapers = [
  wallpaper("wallpaper-2957e087-99e1-42ca-b27c-f7ac31f2a048", "紫境悬浮", "抽象光影", "wallpaper-2957e087-99e1-42ca-b27c-f7ac31f2a048.webp"),
  wallpaper("wallpaper-202fd969-c0c3-41fa-bb47-682007a9b871", "钴蓝层峦", "抽象光影", "wallpaper-202fd969-c0c3-41fa-bb47-682007a9b871.webp"),
  wallpaper("wallpaper-f89ae91b-7454-403e-b910-1cb548b9f00d", "琥珀序列", "抽象光影", "wallpaper-f89ae91b-7454-403e-b910-1cb548b9f00d.webp"),
  wallpaper("wallpaper-78452d67-415d-4c92-ad58-47dbcda2b999", "冰蓝晨弧", "抽象光影", "wallpaper-78452d67-415d-4c92-ad58-47dbcda2b999.webp"),
];

export const officialWallpaperIds = new Set(officialWallpapers.map(item => item.id));
export const bundledWallpaperIds = new Set([...bundledWallpapers, ...retiredOfficialWallpapers].map(item => item.id));
export const isOfficialWallpaperTheme = id => officialWallpaperIds.has(id);

// Release builds keep wallpaper media outside the embedded frontend archive.
// MP4s need byte ranges, while previews use the same resource origin so WebKit
// does not have to resolve gallery images through the frontend protocol.
export async function prepareOfficialWallpaperMedia() {
  if (import.meta.env.DEV || !isTauri()) return;
  const wallpapers = [...bundledWallpapers, ...retiredOfficialWallpapers];
  const videos = wallpapers.filter(item => item.mimeType.startsWith('video/'));
  const resolved = await Promise.all(videos.map(async item => {
    const source = new URL(item.url, window.location.origin);
    const file = source.pathname.slice(source.pathname.lastIndexOf('/') + 1);
    const path = await resolveResource(`wallpapers/official/${file}`);
    return [item, `${convertFileSrc(path)}${source.search}`];
  }));
  for (const [item, url] of resolved) item.url = url;
  const previews = await Promise.all(wallpapers.map(async item => {
    const source = new URL(item.preview, window.location.origin);
    const file = source.pathname.slice(source.pathname.lastIndexOf('/') + 1);
    const path = await resolveResource(`wallpapers/official/previews/${file}`);
    return [item, convertFileSrc(path)];
  }));
  for (const [item, url] of previews) {
    item.preview = url;
    if (item.posterUrl) item.posterUrl = url;
  }
}
