#!/data/data/com.termux/files/usr/bin/bash
# ------------------------------------------------------------
# Termux one‑click starter for the LMStudio‑Chat web client.
# It installs any missing dependencies, makes sure we are in the
# directory that contains index.html / app.js / style.css and then
# launches a tiny static HTTP server (Python) on port 8080.
# ------------------------------------------------------------

# Install python if it is not already present (Termux package name)
if ! command -v python >/dev/null 2>&1; then
    echo "Installing Python…"
    pkg install -y python
fi

# Change to the directory where this script lives – that directory must contain the web files.
cd "$(dirname "$0")" || { echo "Failed to cd into script directory"; exit 1; }

# If this folder is a git checkout, pull the latest version (optional).
if [ -d .git ]; then
    echo "Updating repository…"
    git pull --quiet
fi

# Start the static server. Bind to all interfaces so other devices on the LAN can reach it.
# You may change the port number if 8080 is already in use.
PORT=8080
echo "Starting HTTP server on http://0.0.0.0:${PORT}/"
python -m http.server ${PORT} --bind 0.0.0.0
