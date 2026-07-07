export type DateFilter = 'hour' | 'day' | 'week' | 'month' | 'all';

export const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'hour', label: 'Last Hour' },
  { value: 'day', label: 'Last Day' },
  { value: 'week', label: 'Last Week' },
  { value: 'month', label: 'Last Month' },
  { value: 'all', label: 'All Time' },
];

const HOURS_FOR_FILTER: Record<Exclude<DateFilter, 'all'>, number> = {
  hour: 1,
  day: 24,
  week: 24 * 7,
  month: 24 * 30,
};

export function matchesDateFilter(sightedAt: string, filter: DateFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  const hours = HOURS_FOR_FILTER[filter];
  return Date.now() - new Date(sightedAt).getTime() <= hours * 60 * 60 * 1000;
}
