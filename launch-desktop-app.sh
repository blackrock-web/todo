#!/bin/bash
echo "===================================================================="
echo " Daily Relational Todo - Desktop Launcher (Offline Secure Storage)"
echo "===================================================================="
echo
echo "[1/3] Ensuring local dependencies are installed..."
npm install
echo
echo "[2/3] Spinning up local Express and Vite servers..."
npm run dev &
SERVER_PID=$!
echo
echo "[3/3] Waiting for server initialization..."
sleep 3
echo
echo "Launching standalone view..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  if [ -d "/Applications/Google Chrome.app" ]; then
    open -a "Google Chrome" --args --app=http://localhost:3000
  else
    open http://localhost:3000
  fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  if command -v google-chrome &> /dev/null; then
    google-chrome --app=http://localhost:3000 &
  else
    xdg-open http://localhost:3000 &
  fi
else
  python -m webbrowser http://localhost:3000 2>/dev/null || open http://localhost:3000 || xdg-open http://localhost:3000
fi

echo
echo "--------------------------------------------------------------------"
echo "[SUCCESS] Daily Relational Todo is active at http://localhost:3000"
echo
echo "NOTE: To stop the server, press Ctrl+C or close this terminal window."
echo "--------------------------------------------------------------------"
wait $SERVER_PID
