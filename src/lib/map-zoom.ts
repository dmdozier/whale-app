// Approximates the integer zoom level (as used by web-Mercator-based
// systems like supercluster) that a react-native-maps Region is showing,
// based on its longitude span. This doesn't need to be pixel-accurate —
// it's only used to decide how aggressively to cluster.
export function zoomLevelForRegion(longitudeDelta: number): number {
  const zoom = Math.log2(360 / longitudeDelta);
  return Math.max(0, Math.min(20, Math.round(zoom)));
}

// Inverse of the above: the longitude/latitude delta a Region needs in
// order to show approximately the given zoom level. Used to build a
// region to animate to when zooming into a tapped cluster.
export function regionDeltaForZoomLevel(zoom: number): number {
  return 360 / Math.pow(2, zoom);
}
