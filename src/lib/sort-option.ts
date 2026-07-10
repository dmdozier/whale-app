export type SortOption = 'nearest' | 'recent';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'nearest', label: 'Nearest' },
  { value: 'recent', label: 'Most Recent' },
];
