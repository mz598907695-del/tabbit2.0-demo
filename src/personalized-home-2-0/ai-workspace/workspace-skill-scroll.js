// Section positions are cached on layout changes, not measured on every scroll.
export function getSkillScrollAnchor({ sections, scrollTop, maxScroll, headerOffset, fallback = 'all' }) {
  if (!sections.length || scrollTop <= 1) return fallback;
  // The final heading may never reach the sticky header in a short last section.
  if (maxScroll > 1 && scrollTop >= maxScroll - 1) return sections.at(-1).id;
  let current = fallback;
  for (const section of sections) {
    if (section.top > scrollTop + headerOffset + 1) break;
    current = section.id;
  }
  return current;
}
