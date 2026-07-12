#!/bin/bash
# ==========================================
# SETUP SCRIPT - Daily Tasks Secure Vault
# ==========================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Initializing setup in: $PROJECT_DIR"

# 1. Check for Node.js & npm
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Please install Node.js (v18+) to run this application."
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed. Please install npm to continue."
  exit 1
fi

echo "✓ Node.js and npm verified."

# 2. Rotate the local install marker so any existing local database (IndexedDB) and
#    cached local storage from a previous install gets wiped on first launch.
ENV_FILE="$PROJECT_DIR/.env"
INSTALL_ID="$(date +%s)-$RANDOM-$RANDOM"
touch "$ENV_FILE"
if grep -q '^VITE_INSTALL_ID=' "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s/^VITE_INSTALL_ID=.*/VITE_INSTALL_ID=\"$INSTALL_ID\"/" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
else
  echo "VITE_INSTALL_ID=\"$INSTALL_ID\"" >> "$ENV_FILE"
fi
echo "✓ Local database reset marker generated — any existing local data will be cleared on first launch."

# 3. Install dependencies
echo "Installing npm dependencies..."
npm install

# 4. Build production bundle
echo "Building the application production bundle..."
npm run build

# 5. Create Desktop Shortcut for Linux
DESKTOP_DIR="$HOME/Desktop"
SHORTCUT_PATH="$DESKTOP_DIR/DailyTasks.desktop"

echo "Generating Desktop Launcher shortcut..."

cat <<EOF > "$SHORTCUT_PATH"
[Desktop Entry]
Version=1.0
Type=Application
Name=Daily Tasks Secure Vault
Comment=Secure task organizer with local encryption, backup, and sync
Exec=/bin/bash "$PROJECT_DIR/start.sh"
Path=$PROJECT_DIR
Icon=utilities-terminal
Terminal=true
Categories=Office;Utility;
StartupNotify=true
EOF

# Make shortcut and start script executable
chmod +x "$SHORTCUT_PATH"
chmod +x "$PROJECT_DIR/start.sh"
chmod +x "$PROJECT_DIR/destroy.sh" 2>/dev/null || true

echo "==========================================="
echo "✓ Setup Complete!"
echo "✓ A desktop launcher shortcut has been created at: $SHORTCUT_PATH"
echo "  You can double-click this shortcut on your desktop to launch the app!"
echo "==========================================="
