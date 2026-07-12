#!/bin/bash
# ==========================================
# DESTROY SCRIPT - Daily Tasks Secure Vault
# ==========================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHORTCUT_PATH="$HOME/Desktop/DailyTasks.desktop"

echo "=================================================="
echo "WARNING: YOU ARE ABOUT TO COMPLETELY DESTROY THIS PROJECT"
echo "This will permanently remove:"
echo " - The desktop launcher shortcut"
echo " - All source code files, configurations, and database state"
echo " - The entire directory: $PROJECT_DIR"
echo "=================================================="
read -p "Are you absolutely sure you want to proceed? (y/N): " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
  echo "Terminating any lingering Node/App server processes..."
  pkill -f "tsx server.ts" || true
  pkill -f "dist/server.cjs" || true

  echo "Removing desktop launcher shortcut..."
  if [ -f "$SHORTCUT_PATH" ]; then
    rm -f "$SHORTCUT_PATH"
    echo "✓ Desktop shortcut removed."
  fi

  echo "Purging all project files..."
  # Clean up directory contents first
  rm -rf "$PROJECT_DIR/node_modules" 2>/dev/null || true
  rm -rf "$PROJECT_DIR/dist" 2>/dev/null || true
  
  # Remove project folder
  cd "$PROJECT_DIR/.."
  rm -rf "$PROJECT_DIR"
  
  echo "✓ Project destroyed successfully. Thank you!"
else
  echo "Destruction cancelled."
fi
