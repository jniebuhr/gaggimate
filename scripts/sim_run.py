# Adds a "run" custom target to the display-sim env so the desktop simulator can
# be built and launched directly (CLI: `pio run -e display-sim -t run`, or as a
# clickable task under the env in the PlatformIO IDE tool window). [GM-107]
Import("env")

program = "$BUILD_DIR/${PROGNAME}${PROGSUFFIX}"

env.AddCustomTarget(
    name="run",
    dependencies=[program],  # build the simulator first
    actions=[program],       # then launch it
    title="Run Simulator",
    description="Build and launch the GaggiMate desktop simulator",
)
