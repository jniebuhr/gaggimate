## Summary

Add a live weight readout to the Brew screen next to the shot timer so users can monitor real-time yield while pulling a shot. The feature shows either the current Bluetooth scale weight while brewing or the pre-brew tare/weight when not in a brew.

This PR also includes a small regression fix for the Build/Display environment: restored missing `uic_BrewScreen_currentDuration` declaration and header extern that can be referenced across the UI codebase.

## Commit & author history

- Squashed into a single commit: `feat(ui): Add live weight readout to Brew screen — squash (incl. regression fix)` ([7f949f18])
- Commit author set to: `KT-0001 <applekirk@googlemail.com>`
- I also cleaned the patch file to remove the local author email, and verified there are no remaining `kirk@Kirks-MacBook-Pro.local` occurrences.

## Changes (high-level)

- UI: Add a `weightLabel` to the Brew screen (label aligned next to timer) and wire it so updates happen in the `DefaultUI` reactive logic.
- UI: Expose `uic_BrewScreen_currentDuration` across UI code so other modules can reference the Brew screen's timer safely.
- Build: Restored added global and extern to fix the previous undefined symbol link error in `display` env.
- Web/UI: Add binary index parsing and VisualizerService improvements and small UI mock for the Brew screen with live weight.

## Files of interest

- `src/display/ui/default/lvgl/screens/ui_BrewScreen.c` — `ui_BrewScreen_weightLabel` and `uic_BrewScreen_currentDuration` declaration and usage
- `src/display/ui/default/lvgl/screens/ui_BrewScreen.h` — added `extern lv_obj_t *uic_BrewScreen_currentDuration;`
- `src/display/ui/default/DefaultUI.cpp` — added reactive updates for weight and timer UI
- `docs/ui/mocks/brew-screen-live-weight.svg` — mock for the change
- `gaggimate-feat-live-weight-brew-screen.patch` — added and sanitized to avoid leaking local email

## Build & verification

Locally verified builds:

- `display` — SUCCESS
- `display-headless` — SUCCESS
- `controller` — SUCCESS

I compiled the repo via PlatformIO using the local venv, and the `display` undefined symbol issue was fixed on this branch.

## Testing / How I tested

1. Build the `display` and `controller` environments with PlatformIO (commands below)
2. Inspected `docs/ui/mocks/brew-screen-live-weight.svg` for UI layout
3. Verified `uic_BrewScreen_currentDuration` is defined and visible in the firmware map and no link errors remain

Commands you can run to validate locally:

```bash
git fetch myfork && git checkout myfork/KT-0001/live-weight-brew-screen
# Build environments
/Users/kirk/Projects/gaggimate/.venv/bin/python -m platformio run --environment display
/Users/kirk/Projects/gaggimate/.venv/bin/python -m platformio run --environment display-headless
/Users/kirk/Projects/gaggimate/.venv/bin/python -m platformio run --environment controller
```

## Notes for reviewers

- This PR was intentionally squashed to produce a clean single commit for the feature and to remove the local-commit author issue that previously failed the CLA bot check.
- If CI or CLA checks fail, please re-run the associated checks or advise which step is needed.
- I'd appreciate a review for UI alignment and any LVGL styling concerns; the main logic is implemented, and default values/default states are handled by existing profile settings.

---

If you'd like me to re-split the commit into multiple logical commits (for an easier review), I can rebase this into smaller changes. Otherwise, this single commit should be PR-clean and ready for review.
Closes #505

# ...paste the whole PR body from above here...
