import { officialWallpapers, retiredOfficialWallpapers } from './officialWallpapers';

// Legacy samples remain resolvable for saved spaces. The gallery uses the
// curated official catalog; bundled assets never enter the upload delete path.
export const exampleWallpapers = [
  { id: 'example-wallpaper-blue-meadow', name: '追光旷野', url: '/personalized-home-2-0/asset/wallpapers/examples/blue-meadow.jpg', mimeType: 'image/jpeg' },
  { id: 'example-wallpaper-cloud-meadow', name: '云上草原', url: '/personalized-home-2-0/asset/wallpapers/examples/cloud-meadow.jpg', mimeType: 'image/jpeg' },
  { id: 'example-wallpaper-golden-gate', name: '金门晨雾', url: '/personalized-home-2-0/asset/wallpapers/examples/golden-gate.jpg', mimeType: 'image/jpeg' },
  { id: 'example-wallpaper-pink-cats', name: '粉霞双猫', url: '/personalized-home-2-0/asset/wallpapers/examples/pink-cats.jpg', mimeType: 'image/jpeg' },
  { id: 'example-wallpaper-sunlit-mountain', name: '日照金山', url: '/personalized-home-2-0/asset/wallpapers/examples/sunlit-mountain.jpg', mimeType: 'image/jpeg' },
];

// Its original ID is retained in the curated official catalog.
export const demoUploadedWallpaper = {
  id: 'example-uploaded-wallpaper-golden-gate-coast',
  name: '金门海岸',
  url: '/personalized-home-2-0/asset/wallpapers/examples/golden-gate-coast.jpg',
  mimeType: 'image/jpeg',
};

const allExampleWallpapers = [...officialWallpapers, ...retiredOfficialWallpapers, ...exampleWallpapers, demoUploadedWallpaper];

export function getExampleWallpaper(id) {
  return allExampleWallpapers.find(item => item.id === id);
}

export function isExampleWallpaperTheme(id) {
  return Boolean(getExampleWallpaper(id));
}

export function isDemoUploadedWallpaperTheme(id) {
  return id === demoUploadedWallpaper.id;
}
