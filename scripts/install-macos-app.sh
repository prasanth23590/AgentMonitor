#!/bin/bash
# Creates ~/Applications/Agent Monitor.app pointing at the current project directory.
# Run once after cloning: bash scripts/install-macos-app.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Agent Monitor"
APP_DIR="$HOME/Applications/$APP_NAME.app/Contents"
MACOS_DIR="$APP_DIR/MacOS"
RES_DIR="$APP_DIR/Resources"

mkdir -p "$MACOS_DIR" "$RES_DIR"

# Info.plist
cat > "$APP_DIR/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>agent-monitor</string>
  <key>CFBundleIdentifier</key>
  <string>com.local.agent-monitor</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>LSUIElement</key>
  <false/>
</dict>
</plist>
PLIST

# Launcher — uses the project dir where the script lives, not a hardcoded path
cat > "$MACOS_DIR/agent-monitor" << LAUNCHER
#!/bin/bash
PROJECT="$PROJECT_DIR"
PORT=3001
VITE_PORT=5173

lsof -ti:\$PORT | xargs kill -9 2>/dev/null
lsof -ti:\$VITE_PORT | xargs kill -9 2>/dev/null
sleep 0.5

cd "\$PROJECT"
# Source shell profile to inherit user's PATH and env vars (e.g. claude CLI location)
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:\$PATH"
[ -f "\$HOME/.zshrc" ]   && source "\$HOME/.zshrc"   2>/dev/null || true
[ -f "\$HOME/.bashrc" ]  && source "\$HOME/.bashrc"  2>/dev/null || true
[ -f "\$HOME/.profile" ] && source "\$HOME/.profile" 2>/dev/null || true
nohup npm run dev > /tmp/agent-monitor.log 2>&1 &

for i in \$(seq 1 20); do
  sleep 0.5
  if curl -s -o /dev/null http://localhost:\$VITE_PORT; then
    break
  fi
done

open "http://localhost:\$VITE_PORT"
LAUNCHER

chmod +x "$MACOS_DIR/agent-monitor"

# Copy icon
if [ -f "$PROJECT_DIR/assets/icon.icns" ]; then
  cp "$PROJECT_DIR/assets/icon.icns" "$RES_DIR/AppIcon.icns"
fi

# Register with Launch Services
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister \
  -f "$HOME/Applications/$APP_NAME.app" 2>/dev/null || true

echo "✓ Installed: ~/Applications/$APP_NAME.app"
echo "  Drag it to your Dock or launch via Spotlight (Cmd+Space → Agent Monitor)"
