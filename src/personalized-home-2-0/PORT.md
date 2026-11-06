Source: https://github.com/TabbitAi/tabbit-demos/tree/38587e64eda5694d6a5341dc917ebf3c1319fc28/app/personalized-home-2-0/_prototype
Target: https://demo.tabai-test.meituan.com/personalized-home-2-0
Original artwork copied without modification. Interface icons adapted to project voice-line icon font; host shortcuts forwarded to browser shell.

Homepage adaptation: removed unused AI workspace/standalone bookmarks demos and sidebar scheme settings. Background, scroll content, and controls are separate components; scroll/feed DOM stays for sticky composer geometry.

Inline React integration: index.jsx mounts directly in the browser content area. Homepage CSS uses @scope (.personalized-home); theme variables and portal hosts stay in this subtree. Viewport units use the measured content dimensions. No iframe or separate HTML entry.
