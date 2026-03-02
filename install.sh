# --- Create Smart Toggle Shortcut ---
echo "📱 Creating smart toggle shortcut..."

SHORTCUT_DIR="$HOME/.shortcuts"
mkdir -p "$SHORTCUT_DIR"

cat <<'EOT' > "$SHORTCUT_DIR/LarryBot-Toggle.sh"
#!/data/data/com.termux/files/usr/bin/bash

cd $HOME/larrybot

STATUS=$(pm2 list | grep LarryBot | grep online)

if [ -z "$STATUS" ]; then
    echo "🚀 Starting LarryBot..."
    pm2 start bot.js --name LarryBot
    pm2 start dashboard.js --name LarryDashboard
    sleep 3
    termux-open-url http://localhost:5000
    echo "✅ LarryBot Started!"
else
    echo "⛔ Stopping LarryBot..."
    pm2 stop LarryBot
    pm2 stop LarryDashboard
    echo "🛑 LarryBot Stopped!"
fi
EOT

chmod +x "$SHORTCUT_DIR/LarryBot-Toggle.sh"

echo "✅ Smart toggle shortcut created!"
echo "👉 Add the 'Termux:Widget' widget to your home screen."
