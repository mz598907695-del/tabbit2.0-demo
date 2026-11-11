import { memo, useMemo } from 'react';
import { projectPage } from './state';

// Static geometry uses the actual page layout without mounting live widgets,
// timers, network requests or imported card scripts inside every thumbnail.
function PageOverviewThumbnail({ page }) {
  const columns = page.preferredColumns || 9;
  const pitch = 756 / columns;
  const gap = page.preferredColumns ? 12 : 16;
  const items = useMemo(() => projectPage(page, columns, 'gap', true, 'free'), [page, columns]);
  return <svg className="page-overview-thumbnail" viewBox="0 0 900 560" aria-hidden="true" focusable="false">
    <foreignObject x="430" y="38" width="40" height="40"><span className="page-overview-brand"/></foreignObject>
    <rect className="page-overview-search" x="180" y="102" width="540" height="40" rx="20"/>
    <circle className="page-overview-search-icon" cx="201" cy="121" r="5"/>
    <path className="page-overview-search-icon" d="m205 125 4 4"/>
    {items.filter(item => item.y < 5).map(item => {
      const x = 72 + item.x * pitch, y = 178 + item.y * pitch;
      const width = item.w * pitch - gap, height = item.h * pitch - gap;
      const widget = item.type === 'widget';
      const label = String(item.title || item.label || '').slice(0, Math.max(2, Math.floor((width - 38) / 15)));
      const image = typeof item.image === 'string' && /^(\/(?!\/)|data:image\/)/.test(item.image) ? item.image : null;
      return <g key={item.id}>
        <rect className="page-overview-mini-card" x={x} y={y} width={width} height={height} rx={widget ? 12 : 16}/>
        {!widget && image ? <image href={image} x={x + (width - 28) / 2} y={y + (height - 28) / 2} width="28" height="28"/> : <rect className="page-overview-mini-icon" x={x + (widget ? 13 : (width - 24) / 2)} y={y + (widget ? 14 : (height - 24) / 2)} width={widget ? 12 : 24} height={widget ? 12 : 24} rx="4"/>}
        {(widget || item.w > 1) && <text className="page-overview-mini-title" x={x + (widget ? 34 : 60)} y={y + (widget ? 26 : 40)}>{label}</text>}
        {widget && height > 90 && <>
          <rect className="page-overview-mini-line" x={x + 14} y={y + 48} width={Math.max(16, width - 28)} height="6" rx="3"/>
          <rect className="page-overview-mini-line" x={x + 14} y={y + 64} width={Math.max(12, (width - 28) * .74)} height="6" rx="3"/>
          {height > 145 && <rect className="page-overview-mini-line" x={x + 14} y={y + 80} width={Math.max(12, (width - 28) * .46)} height="6" rx="3"/>}
        </>}
      </g>;
    })}
    {!items.length && <g className="page-overview-empty-mark"><rect x="432" y="245" width="36" height="36" rx="10"/><path d="M450 255v16m-8-8h16"/></g>}
  </svg>;
}

export default memo(PageOverviewThumbnail);
