#!/bin/bash
# ==========================================
# START SCRIPT - Daily Tasks Secure Vault
# ==========================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "Launching Daily Tasks Secure Vault..."

# Check if node_modules is installed, if not trigger setup
if [ ! -d "node_modules" ]; then
  echo "Dependencies not found. Running setup first..."
  ./setup.sh
fi

# Start the full-stack server in the background
echo "Starting backend server on port 3000..."
npm run dev &
SERVER_PID=$!

# Ensure server stops on script termination
trap "kill $SERVER_PID 2>/dev/null" EXIT

# Wait for server port 3000 to accept connections
echo "Waiting for app to start..."
for i in {1..30}; do
  if command -v nc &> /dev/null; then
    if nc -z localhost 3000 &> /dev/null; then
      break
    fi
  elif command -v curl &> /dev/null; then
    if curl -s http://localhost:3000 &> /dev/null; then
      break
    fi
  else
    sleep 0.5
  fi
  sleep 0.5
done

echo "✓ Application server active."

# Detect browser and open app in dedicated window mode
if command -v google-chrome &> /dev/null; then
  echo "Opening borderless app window via Google Chrome..."
  google-chrome --app=http://localhost:3000
elif command -v chromium-browser &> /dev/null; then
  echo "Opening borderless app window via Chromium..."
  chromium-browser --app=http://localhost:3000
elif command -v chromium &> /dev/null; then
  echo "Opening borderless app window via Chromium..."
  chromium --app=http://localhost:3000
else
  echo "Opening default system browser..."
  if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
  elif command -v open &> /dev/null; then
    open http://localhost:3000
  else
    echo "Please open http://localhost:3000 in your browser."
  fi
fi

# Keep script running while server is active
wait $SERVER_PID
