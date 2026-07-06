const HOUR_MS = 60 * 60 * 1000;

export function isRecentSighting(sightedAt: string, recentHours = 12) {
  return Date.now() - new Date(sightedAt).getTime() <= recentHours * HOUR_MS;
}

export function formatRelativeTime(sightedAt: string) {
  const diffMinutes = Math.round((Date.now() - new Date(sightedAt).getTime()) / 60000);

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}
