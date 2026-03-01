#!/bin/bash
# LarryBot Termux Installer

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

echo -e "${GREEN}⚡ Starting LarryBot installation...${RESET}"

# Update packages
echo -e "${YELLOW}🔄 Updating Termux packages...${RESET}"
pkg update -y && pkg upgrade -y

# Install dependencies
echo -e "${YELLOW}📦 Installing Node.js, git, curl, PM2...${RESET}"
pkg install -y nodejs git curl
npm install pm2 -g

# Clone or update repo
REPO_URL="https://github.com/philz101/LarryBot-Deploy.git"
DIR_NAME="larrybot"

if [ -d "$DIR_NAME" ]; then
    echo -e "${YELLOW}📂 Directory $DIR_NAME exists, pulling latest changes...${RESET}"
    cd "$DIR_NAME" && git pull
else
    echo -e "${YELLOW}📂 Cloning repository...${RESET}"
    git clone "$REPO_URL" "$DIR_NAME"
    cd "$DIR_NAME"
fi

# Install Node.js dependencies
echo -e "${YELLOW}📦 Installing dependencies...${RESET}"
npm install

# Start bot & dashboard with PM2
echo -e "${YELLOW}▶ Starting bot.js and dashboard.js with PM2...${RESET}"
pm2 start bot.js --name "LarryBot"
pm2 start dashboard.js --name "LarryDashboard"
pm2 save

echo -e "${GREEN}✅ Installation complete!${RESET}"
echo -e "${GREEN}🌐 Dashboard running at: http://localhost:5000${RESET}"
echo -e "${GREEN}💡 To expose publicly: cloudflared tunnel --url http://localhost:5000${RESET}"
echo -e "${YELLOW}⚠ Remember to edit .env with your DISCORD_TOKEN and GROQ_API_KEY${RESET}"
