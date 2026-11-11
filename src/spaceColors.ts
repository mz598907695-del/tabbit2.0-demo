export const spaceColors = [
  { name:"默认", color:"#a3a3a3", tintColor:"#f2f7ff", tint:10, darkTint:10 },
  { name:"橙色", color:"#ff8a27", tintColor:"#ffaa00", tint:70, darkTint:20, linkColor:"var(--color-orange-6)", accentToken:"var(--color-orange-4)" },
  { name:"黄色", color:"#ffc401", tintColor:"#ffe007", tint:70, darkTint:20, linkColor:"var(--color-yellow-6)", accentToken:"var(--color-yellow-4)" },
  { name:"绿色", color:"#63be3c", tintColor:"#6deb36", tint:70, darkTint:20, linkColor:"var(--color-green-6)", accentToken:"var(--color-green-4)" },
  { name:"青色", color:"#00bfc9", tintColor:"#00c7fc", tint:70, darkTint:20, linkColor:"var(--color-cyan-6)", accentToken:"var(--color-cyan-4)" },
  { name:"蓝色", color:"#008fff", tintColor:"#47b2ff", tint:70, darkTint:20, linkColor:"var(--color-blue-6)", accentToken:"var(--color-blue-4)" },
  { name:"紫色", color:"#9547ff", tintColor:"#b188ff", tint:70, darkTint:20, linkColor:"var(--color-purple-6)", accentToken:"var(--color-purple-4)" },
  { name:"粉色", color:"#e43dbb", tintColor:"#ffbfe0", tint:70, darkTint:20, linkColor:"var(--color-hotpink-6)", accentToken:"var(--color-hotpink-4)" },
];

export function presetTintForMode(color: string, dark: boolean) {
  const preset = spaceColors.find(item => item.tintColor === color.toLowerCase());
  return preset ? (dark ? preset.darkTint : preset.tint) : undefined;
}
