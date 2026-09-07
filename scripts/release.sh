#!/usr/bin/env bash
set -euo pipefail

# Build controller, display and display-headless like CI and publish them as a GitHub release for an arbitrary tag.
# Mirrors build-nightly.yml: same artifact names, -DNIGHTLY_BUILD, pre-release, an existing release is overwritten and the
# firmware reports the usual describe version (v1.8.1-234-gabc); the release tag itself never lands in the binary.
# Intended for one-off test builds; the CI pipeline (build.yml) still owns v* tags and the update-server channels.

usage() {
    cat <<EOF
Usage: scripts/release.sh [options] <tag>

Builds the three firmware targets (controller, display, display-headless), stages the artifacts in out/
with the CI file names, then force-moves <tag> to HEAD on origin and (re)creates the GitHub release for it.
The firmware version stays the nightly-style describe string (v1.8.1-234-gabc), not the release tag.

Options:
  -t, --title TITLE      Release title (default: "<tag>")
  -b, --notes TEXT       Release notes body (default: auto-generated one-off text)
  -F, --notes-file FILE  Release notes body from a file
  -R, --repo OWNER/REPO  GitHub repository (default: derived from the origin remote)
      --release-flags    Build without -DNIGHTLY_BUILD (default mirrors the nightly channel)
      --no-prerelease    Publish as a regular release (still never marked "Latest")
      --skip-web         Reuse the embedded web UI already in src/display/webassets/
      --skip-build       Publish whatever is already staged in out/
      --allow-dirty      Build with uncommitted changes (version gets a -dirty suffix)
      --dry-run          Build and stage, print the publish steps, but do not touch git remotes or GitHub
  -h, --help             Show this help

Tags of the form v<digits>... are refused: those belong to the CI stable pipeline (push the tag instead).
EOF
}

die() {
    echo "release.sh: $*" >&2
    exit 1
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/out"

TAG=""
TITLE=""
NOTES=""
NOTES_FILE=""
REPO=""
NIGHTLY=1
PRERELEASE=1
SKIP_WEB=0
SKIP_BUILD=0
ALLOW_DIRTY=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
    case "$1" in
    -t | --title)
        TITLE="$2"
        shift 2
        ;;
    -b | --notes)
        NOTES="$2"
        shift 2
        ;;
    -F | --notes-file)
        NOTES_FILE="$2"
        shift 2
        ;;
    -R | --repo)
        REPO="$2"
        shift 2
        ;;
    --release-flags) NIGHTLY=0; shift ;;
    --no-prerelease) PRERELEASE=0; shift ;;
    --skip-web) SKIP_WEB=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h | --help)
        usage
        exit 0
        ;;
    -*) die "unknown option: $1 (see --help)" ;;
    *)
        [[ -z "$TAG" ]] || die "unexpected argument: $1"
        TAG="$1"
        shift
        ;;
    esac
done

[[ -n "$TAG" ]] || {
    usage >&2
    exit 1
}
[[ "$TAG" =~ ^v[0-9] ]] && die "'$TAG' looks like a stable version tag; push it and let build.yml release it"
git check-ref-format "refs/tags/$TAG" || die "'$TAG' is not a valid tag name"
[[ -n "$NOTES" && -n "$NOTES_FILE" ]] && die "--notes and --notes-file are mutually exclusive"
[[ -z "$NOTES_FILE" || -f "$NOTES_FILE" ]] || die "notes file not found: $NOTES_FILE"

cd "$ROOT"

# --- preflight -------------------------------------------------------------------------------------------------------
command -v pio >/dev/null || command -v platformio >/dev/null || die "PlatformIO CLI (pio) not found"
PIO="$(command -v pio || command -v platformio)"
if [[ $DRY_RUN -eq 0 ]]; then
    command -v gh >/dev/null || die "GitHub CLI (gh) not found"
    gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"
fi
if [[ -z "$REPO" ]]; then
    ORIGIN_URL="$(git remote get-url origin)"
    REPO="$(sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##' <<<"$ORIGIN_URL")"
    [[ "$REPO" =~ ^[^/]+/[^/]+$ ]] || die "could not derive OWNER/REPO from origin ($ORIGIN_URL); pass --repo"
fi
if [[ $ALLOW_DIRTY -eq 0 && -n "$(git status --porcelain --untracked-files=no)" ]]; then
    die "working tree has uncommitted changes; commit them or pass --allow-dirty"
fi

HEAD_SHA="$(git rev-parse HEAD)"
BRANCH="$(git branch --show-current || true)"
echo "==> Release '$TAG' from ${BRANCH:-detached} @ ${HEAD_SHA:0:8} to $REPO"

# Node 22 for the web UI (system default may be older); nvm's scripts are not set -u clean.
ensure_node() {
    node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
    if (($(node_major) < 22)); then
        export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
        if [[ -s "$NVM_DIR/nvm.sh" ]]; then
            set +u
            # shellcheck disable=SC1091
            . "$NVM_DIR/nvm.sh"
            nvm use >/dev/null || nvm use 22 >/dev/null
            set -u
        fi
    fi
    (($(node_major) >= 22)) || die "Node 22+ required for the web UI build (found $(node --version 2>/dev/null || echo none))"
}

# --- build -----------------------------------------------------------------------------------------------------------
if [[ $SKIP_BUILD -eq 0 ]]; then
    rm -rf "$OUT"
    mkdir -p "$OUT"
    # Same derivation as auto_firmware_version.py: only v* tags count, so this release tag never shows up in the version.
    VERSION="$(git describe --tags --dirty --match 'v*')"
    echo "$VERSION" >"$OUT/version.txt"
    echo "==> Firmware version: $VERSION"

    if [[ $NIGHTLY -eq 1 ]]; then
        export PLATFORMIO_BUILD_FLAGS="${PLATFORMIO_BUILD_FLAGS:-} '-DNIGHTLY_BUILD'"
        echo "==> Building with -DNIGHTLY_BUILD (nightly channel behaviour)"
    fi

    if [[ $SKIP_WEB -eq 0 ]]; then
        echo "==> Building web UI"
        ensure_node
        "$ROOT/scripts/build_webui.sh"
    else
        [[ -f "$ROOT/src/display/webassets/web_ui_manifest.h" ]] ||
            die "--skip-web given but src/display/webassets/ is empty; run scripts/build_webui.sh first"
        echo "==> Reusing embedded web UI from src/display/webassets/"
    fi

    echo "==> Building controller"
    "$PIO" run -e controller
    cp .pio/build/controller/firmware.bin "$OUT/board-firmware.bin"
    cp .pio/build/controller/partitions.bin "$OUT/board-partitions.bin"
    cp .pio/build/controller/bootloader.bin "$OUT/board-bootloader.bin"

    echo "==> Building display filesystem (seed profiles)"
    "$PIO" run -t buildfs -e display
    cp .pio/build/display/littlefs.bin "$OUT/display-filesystem.bin"
    cp .pio/build/display/littlefs.bin "$OUT/display-headless-filesystem.bin"

    echo "==> Building display"
    "$PIO" run -e display
    cp .pio/build/display/firmware.bin "$OUT/display-firmware.bin"
    cp .pio/build/display/partitions.bin "$OUT/display-partitions.bin"
    cp .pio/build/display/bootloader.bin "$OUT/display-bootloader.bin"

    echo "==> Building display-headless"
    "$PIO" run -e display-headless
    cp .pio/build/display-headless/firmware.bin "$OUT/display-headless-firmware.bin"
    cp .pio/build/display-headless/partitions.bin "$OUT/display-headless-partitions.bin"
    cp .pio/build/display-headless/bootloader.bin "$OUT/display-headless-bootloader.bin"
else
    [[ -d "$OUT" && -n "$(ls -A "$OUT")" ]] || die "--skip-build given but $OUT is empty"
    echo "==> Reusing artifacts in out/ (version: $(cat "$OUT/version.txt" 2>/dev/null || echo unknown))"
fi

echo "==> Staged artifacts:"
ls -l "$OUT"

# --- publish ---------------------------------------------------------------------------------------------------------
[[ -n "$TITLE" ]] || TITLE="$TAG"
if [[ -n "$NOTES_FILE" ]]; then
    NOTES="$(cat "$NOTES_FILE")"
elif [[ -z "$NOTES" ]]; then
    FLAGS_NOTE="nightly-channel build flags (-DNIGHTLY_BUILD)"
    [[ $NIGHTLY -eq 1 ]] || FLAGS_NOTE="stable build flags"
    NOTES="One-off build of \`$TAG\` from \`${BRANCH:-detached}\` @ $HEAD_SHA ($(date -u +%Y-%m-%dT%H:%MZ)), $FLAGS_NOTE.

Not served on any update channel; flash the files manually. Firmware version: \`$(cat "$OUT/version.txt")\`."
fi

CREATE_ARGS=(--repo "$REPO" --title "$TITLE" --notes "$NOTES" --latest=false --verify-tag)
[[ $PRERELEASE -eq 1 ]] && CREATE_ARGS+=(--prerelease)

if [[ $DRY_RUN -eq 1 ]]; then
    echo "==> Dry run; would now:"
    echo "    git push --force origin $HEAD_SHA:refs/tags/$TAG"
    echo "    gh release delete $TAG --repo $REPO --yes   (if it exists)"
    echo "    gh release create $TAG --repo $REPO --title '$TITLE'$([[ $PRERELEASE -eq 1 ]] && echo ' --prerelease') --latest=false --verify-tag out/*"
    echo "    --- notes ---"
    echo "$NOTES"
    echo "    -------------"
    exit 0
fi

# Push the tag by SHA: no local tag is created, so local git describe output stays untouched.
echo "==> Pushing tag $TAG -> ${HEAD_SHA:0:8} to origin"
git push --force origin "$HEAD_SHA:refs/tags/$TAG"

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    echo "==> Deleting existing release $TAG"
    gh release delete "$TAG" --repo "$REPO" --yes
fi

echo "==> Creating release $TAG"
gh release create "$TAG" "${CREATE_ARGS[@]}" "$OUT"/*
gh release view "$TAG" --repo "$REPO" --json url --jq '.url'
