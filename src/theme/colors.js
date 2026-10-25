// Фирменная палитра «ЦЕЗАРЬ» — согласована с веб-интерфейсом
export const colors = {
  bg: '#f1f5f9',
  card: '#ffffff',
  ink: '#0f172a',
  inkSoft: '#475569',
  line: '#e2e8f0',
  primary: '#b45309',      // янтарно-золотой (легионы Цезаря)
  primaryDark: '#92400e',
  accent: '#1d4ed8',
  danger: '#dc2626',
  ok: '#15803d',
  tabBar: '#ffffff',
};

export const priorityColors = {
  low: '#64748b',
  medium: '#1d4ed8',
  high: '#b45309',
  critical: '#dc2626',
};

export function statusColor(key, webColor) {
  if (webColor) return webColor;
  const map = {
    new: '#64748b', in_progress: '#1d4ed8', done: '#15803d',
    canceled: '#94a3b8', deferred: '#b45309', review: '#7c3aed',
  };
  return map[key] || '#64748b';
}
