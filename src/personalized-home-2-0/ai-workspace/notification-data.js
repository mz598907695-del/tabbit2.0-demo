export const NOTIFICATION_TABS = [['all', '全部'], ['product', '公告'], ['feedback', '服务消息'], ['billing', '会员和支付']];

export function selectNotifications(items, category = 'all', unreadOnly = false) {
  return items.filter(item => (category === 'all' || item.type === category) && (!unreadOnly || item.unread));
}

export function markNotificationsRead(data, ids) {
  const targets = ids ? new Set(ids) : null;
  let changed = false;
  const notifications = data.notifications.map(item => {
    if (!item.unread || (targets && !targets.has(item.id))) return item;
    changed = true;
    return { ...item, unread: false };
  });
  return changed ? { ...data, notifications } : data;
}
