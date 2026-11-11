import { Folder } from '../../icons';

import BookmarkSiteIcon from './BookmarkSiteIcon';

export default function BookmarkBarPreview({ nodes, iconsOnly }) {
  const folder = nodes.find(node => node.kind === 'folder');
  const sample = [...(folder ? [folder] : []), ...nodes.filter(node => node.kind === 'bookmark').slice(0, 3)];
  return <div className="bkm-bar-preview" aria-label="导航栏效果预览">
    <small>效果预览</small>
    <div className="bkm-bar-preview-items">
      {sample.map(node => <span key={node.id} title={node.title} className="bkm-bar-preview-item">
        {node.kind === 'folder' ? <Folder size={14}/> : <BookmarkSiteIcon node={node} size={14}/>}
        {(node.kind === 'folder' || !iconsOnly) && <span>{node.title}</span>}
      </span>)}
      {!sample.length && <span>导航栏暂无内容</span>}
    </div>
  </div>;
}
