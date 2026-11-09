import { useCallback, useState } from 'react';
import BoardCard from './BoardCard';
import { Globe } from "../icons";
import { getShortcutIconCandidates } from './shortcut-icon.js';
import { shortcutIconCache } from './shortcut-icon-cache.js';

function IconArtwork({ item, size, iconSize, appearanceTheme, candidates }) {
  const [{ index, loaded }, setArtwork] = useState(() => shortcutIconCache.resolve(candidates));
  const src = candidates[index];
  const imageReady = useCallback(() => {
    shortcutIconCache.loaded(src);
    setArtwork(current => current.index !== index || current.loaded ? current : { ...current, loaded: true });
  }, [index, src]);
  const imageRef = useCallback(node => {
    // A memory-cached image can already be complete when React attaches it.
    if (node?.complete && node.naturalWidth > 0) imageReady();
  }, [imageReady]);
  const letter = Array.from((item.label || item.name || '').trim())[0];
  const monochrome = !src?.startsWith('/site-icons/') && appearanceTheme === 'dark' && src === item.image && src !== item.customIcon && ['dji', 'openai'].includes(item.key);
  const inset = iconSize === 'large' ? 7 : iconSize === 'medium' ? 11 : null;
  const dimension = inset === null ? size : 50 - inset * 2;

  return <span className="shortcut-icon-artwork" data-size={iconSize} aria-hidden="true" style={{ position: 'relative', display: 'grid', placeItems: 'center', width: dimension, height: dimension, '--shortcut-artwork-inset': `${inset ?? 0}px` }}>
    {!loaded && (letter ? <span className="shortcut-fallback" style={{ fontSize: dimension * .8, lineHeight: 1 }}>{letter}</span> : <Globe size={dimension} strokeWidth={1.5} />)}
    {src && <img key={src} ref={imageRef} src={src} width={dimension} height={dimension} alt="" draggable={false} referrerPolicy="no-referrer"
      style={{ position: 'absolute', inset: 0, width: dimension, height: dimension, objectFit: 'contain', opacity: loaded ? 1 : 0, filter: monochrome ? 'brightness(0) invert(.95)' : 'none' }}
      onLoad={imageReady} onError={() => {
        shortcutIconCache.failed(src);
        setArtwork(shortcutIconCache.resolve(candidates, index + 1));
      }} />}
  </span>;
}

export default function ShortcutIcon({ item = {}, size = 24, iconSize = 'small', appearanceTheme = 'light' }) {
  const candidates = getShortcutIconCandidates(item, appearanceTheme);
  return <IconArtwork key={candidates.join('\n')} item={item} size={size} iconSize={iconSize} appearanceTheme={appearanceTheme} candidates={candidates} />;
}

/** The same 50px surface in the board, catalogue and custom-add preview. */
export function ShortcutIconTile({ item = {}, shape = 'circle', iconSize = 'small', appearanceTheme = 'light', ...props }) {
  return <BoardCard as="span" compact shape={shape} {...props} className="shortcut-icon" data-shortcut-shape={shape} data-brand={item.key}>
    <ShortcutIcon item={item} iconSize={iconSize} appearanceTheme={appearanceTheme} />
  </BoardCard>;
}
