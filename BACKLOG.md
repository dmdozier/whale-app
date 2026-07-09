# Future Enhancements

- Default the Map view's date filter to "Last Hour" instead of "All Time." Reduces visual clutter and helps performance, especially during testing where many sightings end up stacked in the same location.
- Require login again when app is fully closed and reopened (currently stays logged in — intentional for now, to make testing easier)
- Map: tapping a cluster bubble sometimes only partially expands it (e.g. a "16" cluster reveals a couple of sub-clusters instead of jumping straight to individual pins), needing a second tap to fully expand. Confirmed via a standalone test this is normal, expected behavior for hierarchical clustering when many sightings share almost the exact same spot (the library only guarantees the *next* level of the cluster tree per zoom step, not a full expansion to leaves in one jump) — not a bug, just worth knowing if it comes up in feedback.
