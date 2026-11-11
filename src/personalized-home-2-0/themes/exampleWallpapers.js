import { officialWallpapers, communityWallpapers, retiredOfficialWallpapers } from './officialWallpapers';

// Legacy samples remain resolvable for saved spaces. The gallery uses the
// official and community catalogs; bundled assets never enter the upload delete path.
export const exampleWallpapers = [
  { id: 'example-wallpaper-blue-meadow', name: '追光旷野', url: '/personalized-home-2-0/asset/wallpapers/examples/blue-meadow.webp', mimeType: 'image/webp', appearance:'dark' },
  { id: 'example-wallpaper-cloud-meadow', name: '云上草原', url: '/personalized-home-2-0/asset/wallpapers/examples/cloud-meadow.webp', mimeType: 'image/webp', appearance:'light' },
  { id: 'example-wallpaper-golden-gate', name: '金门晨雾', url: '/personalized-home-2-0/asset/wallpapers/examples/golden-gate.webp', mimeType: 'image/webp', appearance:'dark' },
  { id: 'example-wallpaper-pink-cats', name: '粉霞双猫', url: '/personalized-home-2-0/asset/wallpapers/examples/pink-cats.webp', mimeType: 'image/webp', appearance:'dark' },
  { id: 'example-wallpaper-sunlit-mountain', name: '日照金山', url: '/personalized-home-2-0/asset/wallpapers/examples/sunlit-mountain.webp', mimeType: 'image/webp', appearance:'dark' },
];

// Its original ID is retained in the curated official catalog.
export const demoUploadedWallpaper = {
  id: 'example-uploaded-wallpaper-golden-gate-coast',
  name: '金门海岸',
  url: '/personalized-home-2-0/asset/wallpapers/examples/golden-gate-coast.webp',
  mimeType: 'image/webp',
  appearance: 'dark',
};

const allExampleWallpapers = [...officialWallpapers, ...communityWallpapers, ...retiredOfficialWallpapers, ...exampleWallpapers, demoUploadedWallpaper];

export function getExampleWallpaper(id) {
  return allExampleWallpapers.find(item => item.id === id);
}

export function isExampleWallpaperTheme(id) {
  return Boolean(getExampleWallpaper(id));
}

export function isDemoUploadedWallpaperTheme(id) {
  return id === demoUploadedWallpaper.id;
}
