# Future Enhancements

- Require login again when app is fully closed and reopened (currently stays logged in — intentional for now, to make testing easier)
- Map re-centering reliability: the map should re-center on the user's current location every time the Map screen is opened, not just the first time. (Noticed it can get stuck on an old location — possibly related to the laptop going to sleep during a long test session, but should be made reliable regardless.)
- Optional additional fields when logging a sighting: (1) Location type — Sea or Land; (2) Distance estimate — a rough category like Near/Medium/Far rather than an exact number, with a short description of what each category means (e.g., based on how clearly the animal could be seen) rather than a precise distance.
- Map clustering bug: tapping/zooming into a cluster bubble doesn't always reveal all pins it represents (e.g., a "5" cluster only showed 2-3 pins). Only reproduced when many sightings share the exact same location during testing — likely a rare edge case, but worth revisiting.
