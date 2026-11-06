# Local widget fonts

These files are self-hosted assets. They make no runtime requests to a font service.
Both font families are licensed under the SIL Open Font License 1.1; the complete
upstream licenses are included beside the font files.

## Outfit

- File: `outfit-variable.woff2` — **44,904 bytes**.
- Version: **1.100**; normal variable font, weight **100–900**.
- Upstream: <https://github.com/Outfitio/Outfit-Fonts>.
- Source: <https://raw.githubusercontent.com/Outfitio/Outfit-Fonts/main/fonts/variable/Outfit%5Bwght%5D.ttf>.
- License: `OFL-Outfit.txt`.
- Copyright 2021 The Outfit Project Authors.
- Full source repertoire retained: **360 Unicode mappings**.
- `tnum` is present and verified: every digit from 0 through 9 maps to a
  **590-unit advance**. Use `font-variant-numeric: lining-nums tabular-nums`
  for time, temperatures and counters.
- WOFF2 SHA-256: `39e40cf4c4ab7cd2a13f232fda9638a4143156799b05c71368fb6df2685af8ad`.

## LXGW WenKai Lite / 霞鹜文楷轻便版

- File: `lxgw-wenkai-lite-regular.woff2` — **5,270,232 bytes** (5.03 MiB).
- Version: **1.522**, March 17, 2026; normal, weight **400**.
- Upstream: <https://github.com/lxgw/LxgwWenKai-Lite>.
- Release: <https://github.com/lxgw/LxgwWenKai-Lite/releases/tag/v1.522>.
- Source: <https://github.com/lxgw/LxgwWenKai-Lite/releases/download/v1.522/LXGWWenKaiLite-Regular.ttf>.
- License: `OFL-LXGW-WenKai-Lite.txt`.
- Copyright 2021–2026 LXGW; Copyright 2020 The Klee Project Authors.
- Full **Lite edition** repertoire retained: **25,985 glyphs**, **25,598 Unicode
  mappings**, including **20,995 CJK ideographs**. This is not a fixed-copy subset;
  it supports the upstream Lite repertoire for user-entered content. Characters
  outside that repertoire use CSS fallback fonts.
- Original TTF: **13,872,424 bytes**.
- Original TTF SHA-256: `140c99ba4e28e817cec49bf82a0c5fcdc4fe633fb9dfda16d0ee8d59a8545f15`.
- WOFF2 SHA-256: `069ba4bd40a5aea213ad14d90255048c36464f7190cd2655643b12d9be49d095`.

## Packaging and use

Downloaded from the authoritative upstream repositories on 2026-10-17. Converted
from TTF to WOFF2 for web rendering only, without subsetting or changing names,
outlines, weights or spacing. The round-trip validation checked every table,
identical Unicode-to-glyph mappings and identical horizontal metrics. The font
files together total **5,315,136 bytes** (5.07 MiB).

Suggested CSS declarations (the application owns their actual scope):

```css
@font-face {
  font-family: "Outfit";
  src: url("/asset/fonts/outfit-variable.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}

@font-face {
  font-family: "LXGW WenKai Lite";
  src: url("/asset/fonts/lxgw-wenkai-lite-regular.woff2") format("woff2");
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}
```

Use Outfit selectively for numeric display; keep labels in the existing UI font.
Use WenKai at its genuine 400 weight for readable artistic Chinese copy, with
`"Kaiti SC", "STKaiti", serif` as fallbacks. These local webfont files are bundled
with the prototype, not offered as a separately installable desktop font package.
