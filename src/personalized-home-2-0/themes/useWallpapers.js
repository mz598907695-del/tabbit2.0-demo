import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteWallpaper, getWallpaperErrorMessage, readWallpapers, refreshWallpaperVideoPoster, saveWallpaper } from './wallpapers.js';
import { officialWallpaperIds } from './officialWallpapers';

export function useWallpapers() {
  const [wallpapers, setWallpapers] = useState([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const lifecycle = useRef(0);
  const mounted = useRef(false);
  const readyRef = useRef(false);
  const uploadingRef = useRef(false);
  const deletingRef = useRef(null);
  const urls = useRef(new Map());

  const releaseURLs = useCallback(() => {
    for (const item of urls.current.values()) {
      URL.revokeObjectURL(item.url);
      if (item.posterUrl) URL.revokeObjectURL(item.posterUrl);
    }
    urls.current.clear();
  }, []);

  const toDisplayItem = useCallback(record => {
    let media = urls.current.get(record.id);
    if (!media) {
      const url = URL.createObjectURL(record.blob);
      try {
        media = { url, posterUrl:record.poster ? URL.createObjectURL(record.poster) : undefined, posterBlob:record.poster };
        urls.current.set(record.id, media);
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      }
    }
    if (media.posterBlob !== record.poster) {
      const posterUrl = record.poster ? URL.createObjectURL(record.poster) : undefined;
      if (media.posterUrl) URL.revokeObjectURL(media.posterUrl);
      media.posterUrl = posterUrl;
      media.posterBlob = record.poster;
    }
    return { id:record.id, name:record.name, mimeType:record.blob.type, url:media.url, posterUrl:media.posterUrl };
  }, []);

  useEffect(() => {
    const generation = ++lifecycle.current;
    mounted.current = true;
    readyRef.current = false;
    setReady(false);
    setLoading(true);
    readWallpapers({ excludeIds: officialWallpaperIds }).then(records => {
      if (!mounted.current || lifecycle.current !== generation) return;
      // Promoted images resolve from bundled official assets; only new uploads
      // belong to 我的. Keep the original device records as migration backups.
      const items = records.map(toDisplayItem);
      setWallpapers(items);
      readyRef.current = true;
      setReady(true);
      setError('');
      // Keep the video URL/clock stable while repairing covers in the background.
      void (async () => {
        for (const record of records) {
          if (!mounted.current || lifecycle.current !== generation) return;
          try {
            const refreshed = await refreshWallpaperVideoPoster(record);
            if (!refreshed || refreshed === record || !mounted.current || lifecycle.current !== generation || !urls.current.has(record.id)) continue;
            const item = toDisplayItem(refreshed);
            setWallpapers(previous => previous.some(entry => entry.id === item.id) ? previous.map(entry => entry.id === item.id ? item : entry) : previous);
          } catch { /* Keep a usable wallpaper; retry its cover on the next load. */ }
        }
      })();
    }).catch(cause => {
      if (!mounted.current || lifecycle.current !== generation) return;
      releaseURLs();
      setError(getWallpaperErrorMessage(cause));
    }).finally(() => {
      if (mounted.current && lifecycle.current === generation) setLoading(false);
    });
    return () => {
      mounted.current = false;
      readyRef.current = false;
      releaseURLs();
    };
  }, [toDisplayItem, releaseURLs]);

  const upload = useCallback(async (file) => {
    if (!file || !mounted.current || uploadingRef.current) return null;
    if (!readyRef.current) {
      setError('尚未完成本地壁纸读取，请稍后重试或刷新页面');
      return null;
    }
    const generation = lifecycle.current;
    uploadingRef.current = true;
    setUploading(true);
    setError('');
    try {
      const record = await saveWallpaper(file);
      if (!mounted.current || lifecycle.current !== generation) return null;
      const item = toDisplayItem(record);
      setWallpapers(previous => [item, ...previous.filter(existing => existing.id !== item.id)]);
      return item;
    } catch (cause) {
      if (mounted.current && lifecycle.current === generation) setError(getWallpaperErrorMessage(cause));
      return null;
    } finally {
      uploadingRef.current = false;
      if (mounted.current && lifecycle.current === generation) setUploading(false);
    }
  }, [toDisplayItem]);

  const remove = useCallback(async (id) => {
    if (!mounted.current || deletingRef.current) return false;
    if (!readyRef.current) {
      setError('尚未完成本地壁纸读取，请稍后重试或刷新页面');
      return false;
    }
    // Only delete a loaded personal wallpaper; repeated calls after removal are harmless.
    if (!urls.current.has(id)) return false;
    const generation = lifecycle.current;
    deletingRef.current = id;
    setDeletingId(id);
    setError('');
    try {
      await deleteWallpaper(id);
      if (!mounted.current || lifecycle.current !== generation) return false;
      setWallpapers(previous => previous.filter(item => item.id !== id));
      const media = urls.current.get(id);
      if (media) { URL.revokeObjectURL(media.url); if (media.posterUrl) URL.revokeObjectURL(media.posterUrl); }
      urls.current.delete(id);
      return true;
    } catch (cause) {
      if (mounted.current && lifecycle.current === generation) setError(getWallpaperErrorMessage(cause));
      return false;
    } finally {
      deletingRef.current = null;
      if (mounted.current && lifecycle.current === generation) setDeletingId(null);
    }
  }, []);

  return { wallpapers, ready, loading, uploading, deletingId, error, upload, remove };
}
