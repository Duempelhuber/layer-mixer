#!/bin/sh
# Builds the Windows installer (NSIS, x64) on Linux, for trying it out locally.
# Releases are built on a Windows runner by .github/workflows/release.yml.
# The app is the unchanged dist/layer-mixer.html.
# Needs: rustup target x86_64-pc-windows-msvc, cargo-xwin, nsis, lld, llvm, clang.
set -e
cd "$(dirname "$0")"
REPO=..
python3 "$REPO/build.py" >/dev/null
cp "$REPO/dist/layer-mixer.html" web/index.html
export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$PWD/target}"
# version: first argument, or VERSION from build.py as x.y.0 (Windows wants three numbers)
V="${1:-$(sed -n 's/^VERSION = "\(.*\)"/\1/p' "$REPO/build.py").0}"
echo "version $V"
npx tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --config "{\"version\":\"$V\"}"
ls -l "$CARGO_TARGET_DIR"/x86_64-pc-windows-msvc/release/bundle/nsis/
