export const spaceColors = [
  { name:"默认", color:"#a3a3a3", tintColor:"#f2f7ff", tint:10, darkTint:10 },
  { name:"橙色", color:"#ff8a27", tintColor:"#ffaa00", tint:70, darkTint:20 },
  { name:"黄色", color:"#ffc401", tintColor:"#ffe007", tint:70, darkTint:20 },
  { name:"绿色", color:"#63be3c", tintColor:"#6deb36", tint:70, darkTint:20 },
  { name:"青色", color:"#00bfc9", tintColor:"#00c7fc", tint:70, darkTint:20 },
  { name:"蓝色", color:"#008fff", tintColor:"#47b2ff", tint:70, darkTint:20 },
  { name:"紫色", color:"#9547ff", tintColor:"#b188ff", tint:70, darkTint:20 },
  { name:"粉色", color:"#e43dbb", tintColor:"#ffbfe0", tint:70, darkTint:20 },
];

export function presetTintForMode(color: string, dark: boolean) {
  const preset = spaceColors.find(item => item.tintColor === color.toLowerCase());
  return preset ? (dark ? preset.darkTint : preset.tint) : undefined;
}
