import { InfoWidgetContent } from './InfoWidgets';
import { TaskWidgetContent } from './TaskWidgets';
export { coreWidgetCatalog } from './core-widget-data';
const INFO_KINDS = new Set(['clock', 'calendar', 'quote', 'codex-usage', 'weather', 'news']);
export function CoreWidgetContent(props) {
  return INFO_KINDS.has(props.kind) ? <InfoWidgetContent {...props}/> : <TaskWidgetContent {...props}/>;
}
