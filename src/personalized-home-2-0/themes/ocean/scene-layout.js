export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const oceanDepth = (scrollTop, height) => clamp(scrollTop / Math.max(1, height * 2.4), 0, 1);
export const depthName = depth => depth < .22 ? '日光浅海' : depth < .6 ? '海草森林' : '蓝色深渊';
export const fishLimit = width => width < 650 ? 3 : 5;
export const fishArtSources = {
  amber: '/personalized-home-2-0/asset/themes/ocean/fish-amber.webp',
  moon: '/personalized-home-2-0/asset/themes/ocean/fish-moon.webp',
  teal: '/personalized-home-2-0/asset/themes/ocean/fish-teal.webp',
};

// Keep swimming hit targets clear of real homepage controls. The same bounds
// are used for visibility and input, so a fish never intercepts a shortcut.
export function fishFits(x, y, width, height, bounds, obstacles) {
  const box = { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
  return box.left >= 12 && box.right <= bounds.width - 12 && box.top >= 16 && box.bottom <= bounds.height - 80
    && !obstacles.some(rect => box.left < rect.right + 8 && box.right > rect.left - 8 && box.top < rect.bottom + 8 && box.bottom > rect.top - 8);
}

export const fishPopulation = [
  { id: 'sunfin', name: '金尾鱼', art: 'amber', x: .82, y: .76, width: 120, min: 0, max: .42, direction: -1 },
  { id: 'coralfin', name: '珊瑚鱼', art: 'amber', x: .18, y: .64, width: 92, min: .08, max: .56, direction: 1 },
  { id: 'forestfin', name: '海草林的金尾鱼', art: 'amber', x: .65, y: .42, width: 150, min: .26, max: .72, direction: -1 },
  { id: 'moonfin', name: '月光鱼', art: 'moon', x: .28, y: .64, width: 160, min: .42, max: 1, direction: 1 },
  { id: 'bluefin', name: '蓝鳍鱼', art: 'moon', x: .77, y: .72, width: 114, min: .62, max: 1, direction: -1 },
  { id: 'littlemoon', name: '小月光鱼', art: 'moon', x: .66, y: .32, width: 82, min: .74, max: 1, direction: 1 },
  { id: 'jadefin', name: '翡翠鱼', art: 'teal', x: .43, y: .8, width: 110, min: 0, max: .64, direction: 1 },
  { id: 'lagoonfin', name: '深水翡翠鱼', art: 'teal', x: .48, y: .48, width: 128, min: .56, max: 1, direction: -1 },
  { id: 'littlecoral', name: '小珊瑚鱼', art: 'amber', x: .84, y: .52, width: 76, min: .2, max: .82, direction: -1 },
];
