import { useEffect, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { WidgetShell, WidgetButton, useWidgetNow } from './UnifiedWidgetKit';
import { getDailyPicture, nextDailyPicturePatch, normalizeDailyPictureConfig } from './daily-picture-data';
import './daily-picture.css';

export function DailyPictureWidget({ config = {}, onChange, preview = false, active = true, locale = 'zh-CN', appearanceTheme = 'light' }) {
  const english = locale === 'en-US';
  const settings = normalizeDailyPictureConfig(config);
  const now = useWidgetNow(active && !preview, 60000);
  const daily = getDailyPicture(settings, now, appearanceTheme);
  const personal = settings.source === 'photo' && settings.photo;
  const wanted = personal
    ? { id: 'personal', src: settings.photo, title: settings.caption || (english ? 'My photo' : '我的照片'), alt: settings.caption || (english ? 'Your saved photo' : '已保存的照片') }
    : { ...daily, title: english ? daily.titleEn : daily.title, alt: english ? daily.altEn : daily.alt };
  const [displayed, setDisplayed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    const image = new window.Image();
    setLoading(true);
    setFailed(false);
    const fail = () => { if (!cancelled && !settled) { settled = true; setLoading(false); setFailed(true); } };
    const timeout = window.setTimeout(fail, 12000);
    image.onload = async () => {
      if (typeof image.decode === 'function') {
        try { await image.decode(); } catch { /* Some WebViews reject decode for an already loaded data URL. */ }
      }
      if (cancelled || settled) return;
      window.clearTimeout(timeout);
      if (!image.naturalWidth) { fail(); return; }
      settled = true;
      setDisplayed({ src: wanted.src, id: wanted.id, title: wanted.title, alt: wanted.alt, position: wanted.position });
      setLoading(false);
      setFailed(false);
    };
    image.onerror = () => { window.clearTimeout(timeout); fail(); };
    image.src = wanted.src;
    return () => { cancelled = true; window.clearTimeout(timeout); image.onload = null; image.onerror = null; };
  }, [wanted.src, wanted.id, wanted.title, wanted.alt, wanted.position, attempt]);

  const refresh = () => {
    if (preview || loading) return;
    if (failed) { setAttempt(value => value + 1); return; }
    onChange?.(nextDailyPicturePatch(settings, now));
  };
  const refreshLabel = failed ? (english ? 'Retry image' : '重新加载图片') : (english ? 'Refresh daily picture' : '刷新每日一图');
  const status = failed
    ? (english ? 'Could not load this image. Try again.' : '这张图片暂时无法加载，请重试。')
    : loading ? (english ? 'Loading image…' : '正在加载图片…') : '';
  const refreshDisabled = preview || loading || (!onChange && !failed);
  const details = <div className="uw-stack daily-picture-details">
    {displayed && <img className="daily-picture-detail-image" src={displayed.src} alt={displayed.alt} />}
    <div className="daily-picture-detail-caption"><strong>{displayed?.title || wanted.title}</strong><span className="uw-muted">{personal ? (english ? 'Your saved photo' : '已保存的个人照片') : (english ? 'AI-created collection · changes daily · matches your theme' : 'AI 创作图集 · 每日轮换 · 随主题匹配明暗')}</span></div>
    {status && <p className="uw-muted" role="status">{status}</p>}
    <div className="uw-row">
      <WidgetButton onClick={refresh} disabled={refreshDisabled}><RefreshCw aria-hidden="true" />{failed ? (english ? 'Retry' : '重试') : (english ? 'Another view' : '换一张')}</WidgetButton>
      {displayed && <a className="uw-button" href={displayed.src} download={displayed.id === 'personal' ? 'my-photo.jpg' : `${displayed.id}-${appearanceTheme}.webp`}><Download size={14} aria-hidden="true" />{english ? 'Save image' : '保存图片'}</a>}
      {personal && <WidgetButton disabled={!onChange} onClick={() => onChange?.({ source: 'daily' })}>{english ? 'Use daily pictures' : '使用每日一图'}</WidgetButton>}
      {!personal && settings.photo && <WidgetButton disabled={!onChange} onClick={() => onChange?.({ source: 'photo' })}>{english ? 'Use my photo' : '使用我的照片'}</WidgetButton>}
    </div>
  </div>;

  return <WidgetShell className="daily-picture" title={english ? 'Daily picture' : '每日一图'} preview={preview} details={details}
    actions={<button type="button" className="daily-picture-refresh" data-board-interactive="true" onClick={refresh} disabled={refreshDisabled} aria-label={refreshLabel} title={refreshLabel} aria-busy={loading}><RefreshCw size={15} aria-hidden="true" /></button>}
    footer={<><span className="daily-picture-caption">{displayed?.title || wanted.title}</span>{failed && <button type="button" className="daily-picture-retry" data-board-interactive="true" onClick={refresh} disabled={preview}>{english ? 'Retry' : '重试'}</button>}</>}>
    {displayed && <img className="daily-picture-image" src={displayed.src} alt={displayed.alt} draggable="false" style={{ objectPosition: displayed.position || 'center' }} data-picture-id={displayed.id} />}
    <div className="daily-picture-shade" aria-hidden="true" />
    {!displayed && <span className="daily-picture-empty">{failed ? (english ? 'Image unavailable' : '图片暂时无法加载') : (english ? 'Loading…' : '加载中…')}</span>}
    <span className="uw-sr-only" role="status" aria-live="polite">{status}</span>
  </WidgetShell>;
}
