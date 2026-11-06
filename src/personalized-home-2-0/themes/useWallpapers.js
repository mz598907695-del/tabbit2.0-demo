/* eslint-disable -- Preserved upstream prototype snapshot; see ../README.md for isolated validation. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteWallpaper, getWallpaperErrorMessage, readWallpapers, saveWallpaper } from './wallpapers.js';

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

  const toDisplayItem = useCallback((record) => {
    let url = urls.current.get(record.id);
    if (!url) {
      url = URL.createObjectURL(record.blob);
      urls.current.set(record.id, url);
    }
    return { id: record.id, name: record.name, mimeType: record.blob.type, url };
  }, []);

  useEffect(() => {
    const generation = ++lifecycle.current;
    mounted.current = true;
    readyRef.current = false;
    setReady(false);
    setLoading(true);
    readWallpapers().then(records => {
      if (!mounted.current || lifecycle.current !== generation) return;
      const items = records.map(toDisplayItem);
      setWallpapers(items);
      readyRef.current = true;
      setReady(true);
      setError('');
    }).catch(cause => {
      if (!mounted.current || lifecycle.current !== generation) return;
      for (const url of urls.current.values()) URL.revokeObjectURL(url);
      urls.current.clear();
      setError(getWallpaperErrorMessage(cause));
    }).finally(() => {
      if (mounted.current && lifecycle.current === generation) setLoading(false);
    });
    return () => {
      mounted.current = false;
      readyRef.current = false;
      for (const url of urls.current.values()) URL.revokeObjectURL(url);
      urls.current.clear();
    };
  }, [toDisplayItem]);

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
      const url = urls.current.get(id);
      if (url) URL.revokeObjectURL(url);
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
