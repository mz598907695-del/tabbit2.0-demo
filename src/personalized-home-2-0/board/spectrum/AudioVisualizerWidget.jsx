import { Link2, RefreshCw } from 'lucide-react';
import { WidgetShell, WidgetButton, Field, DotMatrixNumber } from './UnifiedWidgetKit';
import { isNativeAudio, useAudioVisualizer } from '../useAudioVisualizer';
import '../audio-visualizer.css';


function Spectrum({ bands = [], clipping, label }) {
  const values = Array.from({ length:32 }, (_,i)=>Math.max(0,Math.min(1,Number(bands[i])||0)));
  return <svg className="av-spectrum v3-audio-spectrum" viewBox="0 0 320 120" preserveAspectRatio="none" role="img" aria-label={label}>
    {values.map((v,i)=>{const h=Math.max(3,v*100);return <rect key={i} x={i*10+2} y={60-h/2} width="5" height={h} rx="2.5" className={v>0.01?'v3-audio-lit':'v3-audio-quiet'} style={clipping?{fill:'var(--v3-danger)'}:undefined}/>;})}
  </svg>;
}
const ERRORS = {
  permission: ['尚未获得音频权限，请允许后重试。', 'Audio access was not granted. Allow access, then retry.'],
  'no-audio': ['没有选到音频。请重新选择音源，并勾选“共享音频”。', 'No audio was shared. Choose a source and enable “Share audio”.'],
  'no-device': ['没有找到麦克风，请连接输入设备后重试。', 'No microphone found. Connect an input device and retry.'],
  busy: ['音频设备暂时不可用，请检查设备连接或权限。', 'Audio input is unavailable. Check its connection and permissions.'],
  unsupported: ['当前环境不支持此音源，可切换麦克风或使用桌面应用。', 'This source is unavailable here. Try a microphone or the desktop app.'],
  failed: ['暂时无法读取声音，请重试或切换音源。', 'Could not read the audio. Retry or choose another source.'],
  'no-frames': ['尚未收到设备声音。请播放一段音频，并检查系统音频录制权限后重试。', 'No audio frames received. Play some audio, check system audio capture permission, and retry.'],
  'system-start': ['无法启动设备音频，请检查系统音频录制权限后重试。', 'Could not start device audio. Check system audio capture permission and retry.'],
  ended: ['音源连接已结束，点击重试重新连接。', 'The audio source ended. Retry to reconnect.'],
};

export function AudioVisualizerWidget({ config = {}, onChange, preview, active = true, locale = 'zh-CN' }) {
  const english = locale.startsWith('en'), t = (zh, en) => english ? en : zh;
  const source = config.source === 'microphone' ? 'microphone' : 'system';
  const enabled = config.paused !== true;
  const { frame, output, status, error, start, stop } = useAudioVisualizer({ source, active, preview, enabled });
  const listening = status === 'listening', requesting = status === 'requesting';
  const intensity = Math.round(Math.max(0, Math.min(1, frame.level || 0)) * 100);
  const dbfs = listening ? frame.dbfs <= -90 || !Number.isFinite(frame.dbfs) ? '−∞' : frame.dbfs.toFixed(1) : '—';
  const native = isNativeAudio(), device = output || (listening ? frame : {});
  const volumeKnown = source === 'system' && Number.isFinite(device.volume), muted = device.muted === true;
  const primaryValue = listening ? intensity : '—';
  const primaryLabel = t('声音强度', 'Signal intensity');
  const sourceName = source === 'microphone' ? t('麦克风', 'Microphone') : t('设备声音', 'Device audio');
  const stateLabel = !enabled ? t('已暂停检测', 'Detection paused')
    : requesting ? t('正在连接', 'Connecting')
      : listening ? muted && source === 'system' ? t('设备已静音', 'Output muted') : intensity > 0 ? t('正在聆听', 'Listening') : t('静候声音', 'Waiting for sound')
        : status === 'waiting' ? t('静候声音', 'Waiting for sound')
          : status === 'needs-source' ? source === 'microphone' ? t('待授权麦克风', 'Microphone access needed') : t('待选择音源', 'Choose an audio source')
            : error ? t('连接未成功', 'Not connected') : t('自动检测', 'Auto detection');
  const errorText = error ? (ERRORS[error] || ERRORS.failed)[english ? 1 : 0] : '';
  const statusPill = <span className={`av-live ${listening ? 'is-on' : ''}`}><i/>{sourceName}</span>;
  const graph = <Spectrum bands={frame.bands} clipping={frame.peak >= .98} label={listening ? t('真实音频频谱，声音强度 ', 'Live audio spectrum, intensity ') + intensity + '%' : t('频谱等待音源连接', 'Spectrum waiting for an audio source')}/>;
  return <WidgetShell title={t('音频可视化', 'Audio spectrum')} preview={preview} className={`av-widget${listening ? ' is-listening' : ' is-waiting'}`}
    footer={<div className="av-footer"><span>{sourceName}</span><span className={listening ? undefined : 'av-idle-caption'}>{listening ? `${dbfs} dBFS` : t('实时频谱', 'Live spectrum')}</span></div>}
    details={<div className="av-detail uw-stack">
      <div className="av-detail-status">{statusPill}<span role="status">{stateLabel}</span></div>
      <div className="av-detail-graph">{graph}</div>
      <div className="av-readings"><div><strong>{listening ? intensity : '—'}<small>%</small></strong><span>{t('声音强度', 'Signal intensity')}</span></div><div><strong>{dbfs}<small>dBFS</small></strong><span>{t('数字音频电平', 'Digital audio level')}</span></div>{volumeKnown && <div><strong>{Math.round(device.volume * 100)}<small>%</small></strong><span>{muted ? t('系统输出 · 已静音', 'Output · muted') : t('系统输出音量', 'System output volume')}</span></div>}</div>
      <Field label={t('音源', 'Audio source')}><select value={source} onChange={event => { stop(); onChange?.({ source: event.target.value }); }}><option value="system">{t('设备播放的声音', 'Device playback audio')}</option><option value="microphone">{t('麦克风 / 环境声音', 'Microphone / surroundings')}</option></select></Field>
      <Field label={t('自动检测', 'Auto detection')}><select value={enabled ? 'on' : 'off'} onChange={event => onChange?.({ paused: event.target.value === 'off' })}><option value="on">{t('开启', 'On')}</option><option value="off">{t('暂停', 'Paused')}</option></select></Field>
      {enabled && (status === 'needs-source' || error) && <div className="uw-row"><WidgetButton className="av-connect" disabled={preview || requesting} onClick={start}>{error ? <RefreshCw/> : <Link2/>}{error ? t('重新连接', 'Reconnect') : source === 'microphone' ? t('允许麦克风', 'Allow microphone') : t('选择音源', 'Choose audio source')}</WidgetButton></div>}
      {listening && <span className="av-source-name">{frame.deviceName || sourceName}</span>}
      {errorText && <p className="av-error" role="alert">{errorText}</p>}
      <p className="uw-muted">{source === 'microphone' ? t('允许麦克风访问后，小组件显示时会自动检测输入声音。', 'After microphone access is granted, detection resumes automatically while the widget is visible.') : native ? t('小组件显示时自动检测设备播放的声音。首次连接请允许系统音频访问；无声时会安静等待。', 'Device playback is detected automatically while this widget is visible. Allow system audio access on first connection; detection waits quietly during silence.') : t('浏览器需要你选择标签页、窗口或屏幕，并勾选共享音频，连接后会自动跟随声音。切换看板或离开标签页后再次使用，需重新选择音源；桌面应用支持自动连接。', 'Choose a tab, window or screen and share its audio; the spectrum then follows automatically. After switching boards or leaving the tab, choose the source again. The desktop app connects automatically.')}</p>
      <p className="uw-muted">{t('仅在本机实时分析，不录制、不上传。声音强度按数字音频电平换算，并非环境分贝；系统音量由设备支持情况决定。暂停检测、切换看板或离开标签页后释放音源。', 'Analyzed locally, without recording or uploading. Intensity is based on digital signal level, not environmental decibels; system volume is shown when supported. Pausing detection, switching boards or leaving the tab releases the source.')}</p>
    </div>}>
    <div className="av-hero"><div className="av-value"><DotMatrixNumber value={primaryValue} label={primaryLabel + ' ' + (primaryValue === '—' ? stateLabel : primaryValue + '%')}/>{listening && <span>%</span>}</div></div>
    <div className="av-state" role="status" title={stateLabel}>{stateLabel}</div>
    <div className="av-graph">{graph}</div>
    {errorText && <span className="av-card-error" title={errorText}>{t('展开查看连接提示', 'Open for connection help')}</span>}
  </WidgetShell>;
}
