// ---------------- SETUP ----------------
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const Groq = require("groq-sdk");

// ---------------- FILE PATHS ----------------
const CONFIG_FILE = path.join(__dirname, "config.json");
const PROMPTS_FILE = path.join(__dirname, "prompts.json");
const PROFILES_FILE = path.join(__dirname, "profiles.json");
const MEMORY_FILE = path.join(__dirname, "memory.json");

// ---------------- UTIL FUNCTIONS ----------------
function readJson(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}, null, 2));
  const raw = fs.readFileSync(file, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getTimeInZone(timeZone) {
  return new Date().toLocaleString("en-US", {
    timeZone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function getMemoryKey(message) {
  const channelId = message.channel?.id || "dm";
  return `${message.author.id}_${channelId}`;
}

// ---------------- VALIDATE ENV ----------------
if (!process.env.DISCORD_TOKEN || !process.env.GROQ_API_KEY) {
  console.error("❌ Missing DISCORD_TOKEN or GROQ_API_KEY");
  process.exit(1);
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ---------------- EXPRESS DASHBOARD ----------------
const app = express();
const PORT = 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // your dashboard files

// ----- CONFIG API -----
app.get("/api/config", (req, res) => res.json(readJson(CONFIG_FILE)));
app.put("/api/config", (req, res) => {
  const config = { ...readJson(CONFIG_FILE), ...req.body };
  writeJson(CONFIG_FILE, config);
  res.json({ message: "✅ Config updated", config });
});

// ----- PROMPTS API -----
app.get("/api/prompts", (req, res) => res.json(readJson(PROMPTS_FILE)));
app.put("/api/prompts/active", (req, res) => {
  const data = readJson(PROMPTS_FILE);
  data.activePrompt = req.body.activePrompt || "default";
  writeJson(PROMPTS_FILE, data);
  res.json({ message: "✅ Active prompt updated", data });
});
app.post("/api/prompts", (req, res) => {
  const data = readJson(PROMPTS_FILE);
  const { key, prompt, name } = req.body;
  if (!data.prompts) data.prompts = {};
  data.prompts[key] = { prompt, name: name || key };
  writeJson(PROMPTS_FILE, data);
  res.json({ message: "✅ Prompt added", data });
});
app.put("/api/prompts/:key", (req, res) => {
  const data = readJson(PROMPTS_FILE);
  const key = req.params.key;
  if (!data.prompts || !data.prompts[key])
    return res.status(404).json({ error: "Prompt not found" });
  data.prompts[key] = { ...data.prompts[key], ...req.body };
  writeJson(PROMPTS_FILE, data);
  res.json({ message: "✅ Prompt updated", data });
});
app.delete("/api/prompts/:key", (req, res) => {
  const data = readJson(PROMPTS_FILE);
  const key = req.params.key;
  if (data.prompts && data.prompts[key]) delete data.prompts[key];
  writeJson(PROMPTS_FILE, data);
  res.json({ message: "🗑️ Prompt deleted", data });
});

// ----- PROFILES API -----
app.get("/api/profiles", (req, res) => res.json(readJson(PROFILES_FILE)));
app.put("/api/profiles", (req, res) => {
  const profiles = { ...readJson(PROFILES_FILE), ...req.body };
  writeJson(PROFILES_FILE, profiles);
  res.json({ message: "✅ Profiles saved", profiles });
});

// ----- MEMORY API -----
app.get("/api/memory", (req, res) => res.json(readJson(MEMORY_FILE)));
app.put("/api/memory", (req, res) => {
  writeJson(MEMORY_FILE, req.body);
  res.json({ message: "✅ Memory saved" });
});
app.delete("/api/memory", (req, res) => {
  writeJson(MEMORY_FILE, {});
  res.json({ message: "🧠 All memory cleared" });
});

// ----- START EXPRESS -----
app.listen(PORT, () => console.log(`🌐 Dashboard running at http://localhost:${PORT}`));

// ---------------- DISCORD BOT ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const cooldowns = new Map();

client.once("ready", () => {
  const config = readJson(CONFIG_FILE);
  console.log(`✅ Chung Lee is online. Local time: ${getTimeInZone(config.timeZone || "America/Toronto")}`);
});

client.on("messageCreate", async (message) => {
  if (!message.content || message.author.bot) return;

  const config = readJson(CONFIG_FILE);
  const promptsData = readJson(PROMPTS_FILE);
  const profilesData = readJson(PROFILES_FILE);
  const memory = readJson(MEMORY_FILE);

  const MODEL = config.model || "llama-3.3-70b-versatile";
  const MAX_MEMORY = config.maxMemory || 10;
  const COOLDOWN_MS = config.cooldownMs || 4000;
  const MAX_TOKENS = config.maxTokens || 250;

  const content = message.content.trim();
  const now = Date.now();
  const userId = message.author.id;

  if (cooldowns.has(userId) && now - cooldowns.get(userId) < COOLDOWN_MS) return;
  cooldowns.set(userId, now);

  const memoryKey = getMemoryKey(message);
  if (!memory[memoryKey]) memory[memoryKey] = [];
  memory[memoryKey].push({ role: "user", content });
  memory[memoryKey] = memory[memoryKey].slice(-MAX_MEMORY);

  const activeKey = promptsData.activePrompt || "default";
  const basePrompt = promptsData.prompts?.[activeKey]?.prompt || "";

  const botProfile = JSON.stringify(profilesData.botProfile || {}, null, 2);
  const userProfile = JSON.stringify(profilesData.userProfile || {}, null, 2);

  const currentTime = getTimeInZone(config.timeZone || "America/Toronto");

  const languageInstruction =
    config.languageMode === "manual"
      ? `Reply strictly in ${config.defaultLanguage}.`
      : "Detect the user's language and reply in the same language.";

  const locationInstruction = `Your current location is ${config.location || "Unknown"}.`;
  const intensionInstruction = `Intention mode: ${config.intensionMode || "friendly"}.`;

  const systemPrompt = `
${basePrompt}

Bot Profile:
${botProfile}

User Profile:
${userProfile}

${languageInstruction}
${locationInstruction}
${intensionInstruction}

Current time: ${currentTime}.
  `.trim();

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: config.temperature ?? 0.85,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        ...memory[memoryKey]
      ]
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) return message.reply("🥺 I didn’t catch that…");

    memory[memoryKey].push({ role: "assistant", content: reply });
    memory[memoryKey] = memory[memoryKey].slice(-MAX_MEMORY);
    writeJson(MEMORY_FILE, memory);

    await message.channel.sendTyping();
    await message.reply(reply);
  } catch (err) {
    console.error("❌ Groq Error:", err.message);
    message.reply("⚠️ Something went wrong…");
  }
});

client.login(DISCORD_TOKEN);