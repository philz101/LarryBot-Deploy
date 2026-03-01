require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const Groq = require("groq-sdk");

/* ================= FILE PATHS ================= */

const CONFIG_FILE = path.join(__dirname, "config.json");
const MEMORY_FILE = path.join(__dirname, "memory.json");
const PROFILES_FILE = path.join(__dirname, "profiles.json");
const PROMPTS_FILE = path.join(__dirname, "prompts.json");

/* ================= UTIL ================= */

function readJson(file) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify({}, null, 2));
    }
    const raw = fs.readFileSync(file, "utf8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getConfig() {
  return readJson(CONFIG_FILE);
}

function getTimeInZone(timeZone) {
  try {
    return new Date().toLocaleString("en-US", {
      timeZone: timeZone || "UTC",
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return new Date().toLocaleString("en-US", {
      timeZone: "UTC",
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }
}

function getMemoryKey(message) {
  return message.guild
    ? `${message.guild.id}_${message.author.id}`
    : `dm_${message.author.id}`;
}

/* ================= VALIDATE ENV ================= */

if (!process.env.DISCORD_TOKEN || !process.env.GROQ_API_KEY) {
  console.error("❌ Missing DISCORD_TOKEN or GROQ_API_KEY");
  process.exit(1);
}

/* ================= INIT ================= */

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

/* ================= READY ================= */

client.once("clientReady", () => {
  const config = getConfig();
  console.log(
    `✅ PARA is Active. Local time: ${getTimeInZone(
      config.timeZone || "UTC"
    )}`
  );
});

/* ================= MESSAGE HANDLER ================= */

const cooldowns = new Map();

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  
  const config = getConfig();
  const profiles = readJson(PROFILES_FILE);
  const prompts = readJson(PROMPTS_FILE);
  const memory = readJson(MEMORY_FILE);

  const userId = message.author.id;
  const now = Date.now();

  const cooldown = config.cooldownMs || 4000;
  if (cooldowns.has(userId) && now - cooldowns.get(userId) < cooldown) {
    return;
  }
  cooldowns.set(userId, now);

  const memoryKey = getMemoryKey(message);
  if (!memory[memoryKey]) memory[memoryKey] = [];

  memory[memoryKey].push({
    role: "user",
    content: message.content
  });

  const maxMemory = config.maxMemory || 10;
  memory[memoryKey] = memory[memoryKey].slice(-maxMemory);

  const activeKey = prompts.activePrompt || "default";

const basePrompt =
  prompts.prompts?.[activeKey]?.prompt ||
  "You are a love one.";

  const languageInstruction =
    config.languageMode === "manual"
      ? `Reply strictly in ${config.defaultLanguage}.`
      : `Detect the user's language automatically and reply in the same language.`;

  const formatProfile = (obj) =>
  obj
    ? Object.entries(obj)
        .map(([k, v]) =>
          `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
        )
        .join("\n")
    : "No data";

const systemPrompt = `
${basePrompt}

Intension: ${config.intensionMode || "Be helpful."}
Location: ${config.location || "Unknown"}
Current Time: ${getTimeInZone(config.timeZone)}

${languageInstruction}

User Profile:
${formatProfile(profiles.userProfile)}

Bot Profile:
${formatProfile(profiles.botProfile)}
`;

  try {
    const completion = await groq.chat.completions.create({
      model: config.model || "llama-3.3-70b-versatile",
      temperature: config.temperature ?? 0.85,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        ...memory[memoryKey]
      ]
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I have no response.";

    memory[memoryKey].push({
      role: "assistant",
      content: reply
    });

    writeJson(MEMORY_FILE, memory);

    await message.reply(reply);
  } catch (err) {
    console.error("❌ Groq Error:", err.message);
    message.reply("⚠️ AI Error occurred.");
  }
});

/* ================= LOGIN ================= */

client.login(process.env.DISCORD_TOKEN);