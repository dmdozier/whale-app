# Future Enhancements

- Require login again when app is fully closed and reopened (currently stays logged in — intentional for now, to make testing easier)
- Map clustering bug: tapping/zooming into a cluster bubble doesn't always reveal all pins it represents (e.g., a "5" cluster only showed 2-3 pins). Only reproduced when many sightings share the exact same location during testing — likely a rare edge case, but worth revisiting. Technical note: this is a side effect of disabling `spiralEnabled` in the crash fix — that feature previously fanned out pins at identical coordinates so they wouldn't stack. A proper fix would need a different, crash-safe way to spread out same-location pins, rather than simply re-enabling that setting.
