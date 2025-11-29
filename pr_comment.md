Short summary:

This PR adds a live weight readout to the Brew screen and fixes a minor build regression (missing UI symbol declaration). I rebased / squashed changes to a single commit for easier review and fixed the commit author so CLA checks should pass now.

Build status (local PlatformIO): `display`, `display-headless`, `controller` all succeed.

Notes for maintainers:
- Re-run CI/CLA checks if necessary — the commit author has been corrected to `KT-0001 <applekirk@googlemail.com>`.
- If any check still fails or if you want incremental commits for review, let me know and I’ll split the changes into smaller commits.

Testing instructions:
1. Check out branch `KT-0001/live-weight-brew-screen` from my fork.
2. Build `display` and `controller` locally with PlatformIO and confirm there are no link errors.
3. Visual checks: `docs/ui/mocks/brew-screen-live-weight.svg` shows the intended layout.

Thank you for taking a look!
