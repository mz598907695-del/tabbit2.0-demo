// Source-controlled examples are separate from browser-owned uploads. They do
// not depend on IndexedDB and never enter the personal wallpaper delete path.
export const exampleWallpapers = [
  { id: 'example-wallpaper-blue-meadow', name: '追光旷野', url: '/personalized-home-2-0/asset/wallpapers/examples/blue-meadow.jpg', mimeType: 'image/jpeg' },
  { id: 'example-wallpaper-cloud-meadow', name: '云上草原', url: '/personalized-home-2-0/asset/wallpapers/examples/cloud-meadow.jpg', mimeType: 'image/jpeg' },
  { id: 'example-wallpaper-golden-gate', name: '金门晨雾', url: '/personalized-home-2-0/asset/wallpapers/examples/golden-gate.jpg', mimeType: 'image/jpeg' },
  { id: 'example-wallpaper-pink-cats', name: '粉霞双猫', url: '/personalized-home-2-0/asset/wallpapers/examples/pink-cats.jpg', mimeType: 'image/jpeg' },
  { id: 'example-wallpaper-sunlit-mountain', name: '日照金山', url: '/personalized-home-2-0/asset/wallpapers/examples/sunlit-mountain.jpg', mimeType: 'image/jpeg' },
];

export function getExampleWallpaper(id) {
  return exampleWallpapers.find(item => item.id === id);
}

export function isExampleWallpaperTheme(id) {
  return Boolean(getExampleWallpaper(id));
}
