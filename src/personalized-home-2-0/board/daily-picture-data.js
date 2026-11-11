import { normalizePhotoConfig } from './leisure-widget-data.js';

const BASE = '/personalized-home-2-0/asset/widgets/daily';
export const DAILY_PICTURES = [
  {
    id: 'forest',
    light: { src: `${BASE}/forest-morning.png`, title: '晨间花影', titleEn: 'Petals in morning light', alt: '白色花瓣迎着柔和晨光，在朦胧绿意中舒展。', altEn: 'White petals open into soft morning light and quiet green bokeh.', position: '60% 42%' },
    dark: { src: `${BASE}/forest-dusk.png`, title: '暮色木兰', titleEn: 'Magnolia at dusk', alt: '木兰花映着暮色与微光，深绿背景宁静柔和。', altEn: 'Magnolia petals catch the last light against deep, quiet greens.' },
  },
  {
    id: 'lake',
    light: { src: `${BASE}/lake-morning.png`, title: '晨雾湖心', titleEn: 'Morning mist on the lake', alt: '清晨的湖面映着柔和天光，远山在薄雾中舒展。', altEn: 'A calm lake reflects morning light beneath softly misted hills.' },
    dark: { src: `${BASE}/lake-dusk.png`, title: '蓝调湖光', titleEn: 'Blue hour on the lake', alt: '蓝调暮色落在平静湖面，远处山影若隐若现。', altEn: 'Blue-hour light rests on a still lake and distant mountain silhouettes.' },
  },
];

export function dailyPictureDay(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? value : '';
}

export function normalizeDailyPictureConfig(config = {}) {
  const photo = normalizePhotoConfig(config);
  const preservePhoto = Boolean(photo.photo) && config?.source !== 'daily';
  return {
    ...photo,
    source: preservePhoto ? 'photo' : 'daily',
    pictureDay: validDay(config?.pictureDay),
    pictureId: DAILY_PICTURES.some(picture => picture.id === config?.pictureId) ? config.pictureId : '',
  };
}

/** A local calendar date picks the scene; the theme picks its lighting. */
export function getDailyPicture(config = {}, date = new Date(), appearanceTheme = 'light') {
  const settings = normalizeDailyPictureConfig(config);
  const day = dailyPictureDay(date);
  const dayNumber = day ? Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) : 0;
  const fallbackIndex = ((dayNumber % DAILY_PICTURES.length) + DAILY_PICTURES.length) % DAILY_PICTURES.length;
  const scene = settings.pictureDay === day && settings.pictureId
    ? DAILY_PICTURES.find(picture => picture.id === settings.pictureId)
    : DAILY_PICTURES[fallbackIndex];
  const variant = scene[appearanceTheme === 'dark' ? 'dark' : 'light'];
  return { id: scene.id, day, ...variant };
}

export function nextDailyPicturePatch(config = {}, date = new Date()) {
  const current = getDailyPicture(config, date);
  const index = DAILY_PICTURES.findIndex(picture => picture.id === current.id);
  return { source: 'daily', pictureDay: dailyPictureDay(date), pictureId: DAILY_PICTURES[(index + 1) % DAILY_PICTURES.length].id };
}
