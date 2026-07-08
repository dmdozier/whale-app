export type LocationType = 'sea' | 'land';
export type DistanceEstimate = 'near' | 'medium' | 'far';

// Icons are deliberately single-codepoint emoji (no variation selectors or
// ZWJ sequences). On Android, react-native-maps rasterizes each Callout's
// content into a bitmap (Google Maps' native SDK can only host a static
// bitmap for its info-window overlay, not a live view), which runs through
// Android's Canvas/text-layout APIs — a much more crash-prone path for
// complex Unicode grapheme clusters than the plain TextView used everywhere
// else in the app. 🏝️ (island + a variation selector) was used here
// originally and is the prime suspect for a crash seen right after saving a
// sighting with both these fields set — the first time any emoji had ever
// been rendered inside a Callout.
export const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string; icon: string }[] = [
  { value: 'sea', label: 'Sea', icon: '🌊' },
  { value: 'land', label: 'Land', icon: '🌳' },
];

export const DISTANCE_OPTIONS: {
  value: DistanceEstimate;
  label: string;
  description: string;
}[] = [
  {
    value: 'near',
    label: 'Near',
    description: 'Could see details clearly — markings, blowhole, etc.',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Could identify the species, but not finer details.',
  },
  {
    value: 'far',
    label: 'Far',
    description: 'Saw a spout or shape — hard to make out details.',
  },
];

export function getLocationTypeOption(value: LocationType | null | undefined) {
  return LOCATION_TYPE_OPTIONS.find((option) => option.value === value) ?? null;
}

export function getDistanceOption(value: DistanceEstimate | null | undefined) {
  return DISTANCE_OPTIONS.find((option) => option.value === value) ?? null;
}

// Compact "🌊 Sea · 📏 Near" style summary for showing these optional fields
// alongside the rest of a sighting's info in the Map popup and List view.
// Returns null when neither field is set, so callers can omit the line
// entirely rather than rendering an empty one.
export function formatSightingExtras(sighting: {
  location_type: LocationType | null;
  distance_estimate: DistanceEstimate | null;
}): string | null {
  const parts: string[] = [];

  const locationOption = getLocationTypeOption(sighting.location_type);
  if (locationOption) {
    parts.push(`${locationOption.icon} ${locationOption.label}`);
  }

  const distanceOption = getDistanceOption(sighting.distance_estimate);
  if (distanceOption) {
    parts.push(`📏 ${distanceOption.label}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}
