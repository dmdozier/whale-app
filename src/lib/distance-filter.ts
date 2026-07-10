export type DistanceFilter = '5' | '25' | '100' | 'all';

export const DISTANCE_FILTER_OPTIONS: { value: DistanceFilter; label: string }[] = [
  { value: '5', label: '5 mi' },
  { value: '25', label: '25 mi' },
  { value: '100', label: '100 mi' },
  { value: 'all', label: 'Any Distance' },
];

const MILES_FOR_FILTER: Record<Exclude<DistanceFilter, 'all'>, number> = {
  '5': 5,
  '25': 25,
  '100': 100,
};

export function matchesDistanceFilter(distanceMiles: number, filter: DistanceFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  return distanceMiles <= MILES_FOR_FILTER[filter];
}
