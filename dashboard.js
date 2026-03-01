const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const CONFIG_FILE = path.join(__dirname, "config.json");
const PROMPTS_FILE = path.join(__dirname, "prompts.json");
const PROFILES_FILE = path.join(__dirname, "profiles.json");
const MEMORY_FILE = path.join(__dirname, "memory.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------- HELPERS ----------------
function readJson(file) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------------- CONFIG CRUD ----------------
app.get("/api/config", (req, res) => res.json(readJson(CONFIG_FILE)));
app.put("/api/config", (req, res) => {
  const config = { ...readJson(CONFIG_FILE), ...req.body };
  writeJson(CONFIG_FILE, config);
  res.json({ message: "✅ Config updated", config });
});

app.use(express.static("public"));
app.listen(5000);

// ---------------- PROMPTS CRUD ----------------
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

// ---------------- PROFILES CRUD ----------------
app.get("/api/profiles", (req, res) => res.json(readJson(PROFILES_FILE)));

app.put("/api/profiles", (req, res) => {
  // Merge the existing profile JSON with the new input
  const profiles = readJson(PROFILES_FILE);
  const updatedProfiles = { ...profiles, ...req.body };
  writeJson(PROFILES_FILE, updatedProfiles);
  res.json({ message: "✅ Profiles saved", profiles: updatedProfiles });
});

// ---------------- MEMORY CRUD ----------------
app.get("/api/memory", (req, res) => res.json(readJson(MEMORY_FILE)));
app.put("/api/memory", (req, res) => {
  writeJson(MEMORY_FILE, req.body);
  res.json({ message: "✅ Memory saved" });
});
app.delete("/api/memory", (req, res) => {
  writeJson(MEMORY_FILE, {});
  res.json({ message: "🧠 All memory cleared" });
});

// ---------------- ENV UPDATE ----------------
app.put("/api/env", (req, res) => {
  const { DISCORD_TOKEN, GROQ_API_KEY } = req.body;

  if (!DISCORD_TOKEN || !GROQ_API_KEY) {
    return res.status(400).json({ error: "Missing keys" });
  }

  const envContent = `
DISCORD_TOKEN=${DISCORD_TOKEN}
GROQ_API_KEY=${GROQ_API_KEY}
`;

  fs.writeFileSync(path.join(__dirname, ".env"), envContent.trim());

  res.json({ message: "✅ Environment variables saved. Restart bot required." });
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);
});