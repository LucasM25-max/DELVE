#!/bin/bash
# Headless-only Godot 4.7.2 build for sandbox QA/smoke runs.
#
# The binary is ~1 GB, so it is deliberately built into /home/user/.cache
# (an unsnapshotted path) — keeping it under the repo would blow the
# workspace artifact cap. Run this, then:
#   GD=/home/user/.cache/godot-src/bin/godot.linuxbsd.editor.dev.x86_64
#   $GD --headless --path . --import
#   $GD --headless --path . --script res://tools/qa_yard.gd
set -x
CACHE=/home/user/.cache
mkdir -p "$CACHE/bin" "$CACHE/logs"
cd "$CACHE" || exit 1

# pkg-config shim: scons only checks that pkg-config *exists* (all
# third-party libs build from bundled sources with builtin_* = True) and
# apt is unreachable in the sandbox.
cat > "$CACHE/bin/pkg-config" <<'EOF'
#!/bin/sh
case "$1" in
  --version) echo "0.29.2"; exit 0;;
esac
exit 1
EOF
chmod +x "$CACHE/bin/pkg-config"

if [ ! -x "$CACHE/venv/bin/scons" ]; then
  python3 -m venv "$CACHE/venv" || exit 1
  "$CACHE/venv/bin/pip" -q install --upgrade pip
  "$CACHE/venv/bin/pip" -q install scons pillow numpy || exit 1
fi

if [ ! -d "$CACHE/godot-src/core" ]; then
  curl -sL -o "$CACHE/godot.tar.gz" \
    https://codeload.github.com/godotengine/godot/tar.gz/refs/tags/4.7.2-stable || exit 1
  tar xzf "$CACHE/godot.tar.gz" -C "$CACHE" || exit 1
  mv "$CACHE/godot-4.7.2-stable" "$CACHE/godot-src" || exit 1
fi

cd "$CACHE/godot-src" || exit 1
export PATH="$CACHE/bin:$PATH"
# The final link has been OOM-killed on this 3.8 GB box; objects are cached,
# so a retry only relinks.
rc=1
for attempt in 1 2 3; do
  "$CACHE/venv/bin/scons" platform=linuxbsd target=editor dev_build=no \
    debug_symbols=no -j2 linker=gold linkflags="-Wl,--no-keep-memory" \
    x11=no wayland=no alsa=no pulseaudio=no dbus=no speechd=no fontconfig=no \
    udev=no touch=no libdecor=no accesskit=no builtin_freetype=yes
  rc=$?
  echo "BUILD_ATTEMPT_$attempt EXIT=$rc"
  [ $rc -eq 0 ] && break
done
echo "BUILD_EXIT=$rc"
ls -la "$CACHE/godot-src/bin/" 2>/dev/null || true
