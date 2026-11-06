// This is a functional gear icon: its guide is also the physical line origin.
export function OceanReel({ phase, onCast }) {
  const busy = ['casting', 'biting', 'reeling'].includes(phase);
  return <button type="button" className="brand-toggle ocean-reel" data-phase={phase}
    onClick={onCast} disabled={busy} aria-label={phase === 'exploring' ? '重新抛线' : '抛出鱼线，探索海洋'}>
    <svg viewBox="0 0 72 64" width="72" height="60" fill="none" aria-hidden="true">
      <path className="ocean-rod" d="M15 56 56 11Q61 7 66 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m14 57 9-10" stroke="#a46d52" strokeWidth="7" strokeLinecap="round" />
      <circle cx="34" cy="36" r="15" fill="#f6dcc1" stroke="currentColor" strokeWidth="1.5" />
      <g className="ocean-reel-spool">
        <circle cx="34" cy="36" r="10" stroke="currentColor" strokeWidth="1" />
        <path d="M34 27v5m8 9-5-3m-12 3 5-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="34" cy="36" r="3" fill="currentColor" />
      </g>
      <path d="M33 40 24 44" stroke="currentColor" strokeWidth="2" />
      <circle cx="23" cy="45" r="3" fill="#a46d52" />
      <circle cx="65" cy="9" r="2" stroke="currentColor" />
    </svg>
    <span className="ocean-reel-hint">{phase === 'exploring' ? '再抛一竿' : '点击抛线'}</span>
  </button>;
}
