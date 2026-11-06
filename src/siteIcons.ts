// User-prepared PNGs, copied byte-for-byte from Desktop/网站图标.
// The eight unlabelled marks use user-authorized demo assignments; see manifest.json.
export const processedSiteIcons: Record<string, string> = {
  "notion": "/site-icons/notion.png?v=08fe78013664",
  "youtube": "/site-icons/youtube.png?v=19cfc1f642ce",
  "deepl": "/site-icons/deepl.png?v=60da0182e937",
  "perplexity": "/site-icons/perplexity.png?v=839a2aa94752",
  "netflix": "/site-icons/netflix.png?v=7d7d66f2257b",
  "spotify": "/site-icons/spotify.png?v=e23909ffdd9d",
  "google": "/site-icons/google.png?v=2477e4a2e4c7",
  "openai": "/site-icons/openai.png?v=429dcf17d120",
  "claude": "/site-icons/claude.png?v=668b71d26e85",
  "dribbble": "/site-icons/dribbble.png?v=218c1a755f41",
  "purposetalent": "/site-icons/purposetalent.png?v=74239aa585af",
  "trickle": "/site-icons/trickle.png?v=8c5761075fd5",
  "zoom": "/site-icons/zoom.png?v=a0bc4969d0b4",
  "canva": "/site-icons/canva.png?v=0b16e4f54b3a",
  "figma": "/site-icons/figma.png?v=4d644ef20c66",
  "nio": "/site-icons/nio.png?v=4cf886fe97f3",
  "qq-music": "/site-icons/qq-music.png?v=9e5c4a335fb7",
  "drive": "/site-icons/drive.png?v=e55aae943d6f",
  "x": "/site-icons/x.png?v=7e6d115fa75b",
  "threads": "/site-icons/threads.png?v=a567e51ebd2e",
  "dji": "/site-icons/dji.png?v=c33bb43dc5b5",
  "douyin": "/site-icons/douyin.png?v=689493f0b951",
  "messenger": "/site-icons/messenger.png?v=9dc18de3ca4a",
  "facebook": "/site-icons/facebook.png?v=e598a13863f3",
  "pinterest": "/site-icons/pinterest.png?v=3bcc59f22e7e",
  "slack": "/site-icons/slack.png?v=ae67a2cee25c",
  "github": "/site-icons/github.png?v=073f7063d17e",
  "yang": "/site-icons/yang.png?v=cee954428390",
  "grok": "/site-icons/grok.png?v=86cf72d3474b"
};
const hostIcons: Record<string, string> = {
  "notion.so": "/site-icons/notion.png?v=08fe78013664",
  "notion.com": "/site-icons/notion.png?v=08fe78013664",
  "youtube.com": "/site-icons/youtube.png?v=19cfc1f642ce",
  "youtu.be": "/site-icons/youtube.png?v=19cfc1f642ce",
  "deepl.com": "/site-icons/deepl.png?v=60da0182e937",
  "perplexity.ai": "/site-icons/perplexity.png?v=839a2aa94752",
  "netflix.com": "/site-icons/netflix.png?v=7d7d66f2257b",
  "spotify.com": "/site-icons/spotify.png?v=e23909ffdd9d",
  "open.spotify.com": "/site-icons/spotify.png?v=e23909ffdd9d",
  "google.com": "/site-icons/google.png?v=2477e4a2e4c7",
  "chatgpt.com": "/site-icons/openai.png?v=429dcf17d120",
  "chat.openai.com": "/site-icons/openai.png?v=429dcf17d120",
  "openai.com": "/site-icons/openai.png?v=429dcf17d120",
  "claude.ai": "/site-icons/claude.png?v=668b71d26e85",
  "anthropic.com": "/site-icons/claude.png?v=668b71d26e85",
  "dribbble.com": "/site-icons/dribbble.png?v=218c1a755f41",
  "purposetalent.xyz": "/site-icons/purposetalent.png?v=74239aa585af",
  "trickle.so": "/site-icons/trickle.png?v=8c5761075fd5",
  "zoom.us": "/site-icons/zoom.png?v=a0bc4969d0b4",
  "canva.com": "/site-icons/canva.png?v=0b16e4f54b3a",
  "figma.com": "/site-icons/figma.png?v=4d644ef20c66",
  "nio.cn": "/site-icons/nio.png?v=4cf886fe97f3",
  "nio.com": "/site-icons/nio.png?v=4cf886fe97f3",
  "y.qq.com": "/site-icons/qq-music.png?v=9e5c4a335fb7",
  "drive.google.com": "/site-icons/drive.png?v=e55aae943d6f",
  "x.com": "/site-icons/x.png?v=7e6d115fa75b",
  "twitter.com": "/site-icons/x.png?v=7e6d115fa75b",
  "threads.net": "/site-icons/threads.png?v=a567e51ebd2e",
  "threads.com": "/site-icons/threads.png?v=a567e51ebd2e",
  "dji.com": "/site-icons/dji.png?v=c33bb43dc5b5",
  "douyin.com": "/site-icons/douyin.png?v=689493f0b951",
  "tiktok.com": "/site-icons/douyin.png?v=689493f0b951",
  "messenger.com": "/site-icons/messenger.png?v=9dc18de3ca4a",
  "facebook.com": "/site-icons/facebook.png?v=e598a13863f3",
  "pinterest.com": "/site-icons/pinterest.png?v=3bcc59f22e7e",
  "slack.com": "/site-icons/slack.png?v=ae67a2cee25c",
  "github.com": "/site-icons/github.png?v=073f7063d17e",
  "yang.design": "/site-icons/yang.png?v=cee954428390",
  "grok.com": "/site-icons/grok.png?v=86cf72d3474b"
};

export function processedSiteIconFor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (processedSiteIcons[value]) return processedSiteIcons[value];
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    return hostIcons[url.hostname.toLowerCase().replace(/^www\./, "")];
  } catch { return undefined; }
}
