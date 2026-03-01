// ---------------- TABS ----------------
function showTab(tabId) {
  document.querySelectorAll(".tab").forEach(t => (t.style.display = "none"));
  const el = document.getElementById(tabId);
  if (el) el.style.display = "block";
}

// ---------------- ENV / TOKENS ----------------
async function saveEnv() {
  const DISCORD_TOKEN = document.getElementById("discordToken").value.trim();
  const GROQ_API_KEY = document.getElementById("groqKey").value.trim();

  if (!DISCORD_TOKEN || !GROQ_API_KEY) {
    alert("Both fields are required.");
    return;
  }

  await fetch("/api/env", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ DISCORD_TOKEN, GROQ_API_KEY })
  });

  alert("✅ Keys saved. Restart your bot.");
}

// ---------------- SETTINGS ----------------
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();

    document.getElementById("model").value = data.model || "";
    document.getElementById("temperature").value = data.temperature ?? 0.85;
    document.getElementById("maxMemory").value = data.maxMemory ?? 10;
    document.getElementById("cooldownMs").value = data.cooldownMs ?? 4000;
    document.getElementById("maxTokens").value = data.maxTokens ?? 250;
    document.getElementById("languageMode").value = data.languageMode || "auto";
    document.getElementById("defaultLanguage").value = data.defaultLanguage || "English";
    document.getElementById("timeZone").value = data.timeZone || "America/Toronto";
    document.getElementById("location").value = data.location || "Toronto, Canada";
    document.getElementById("intensionMode").value = data.intensionMode || "romantic";
  } catch (err) {
    console.error("Failed to load config:", err);
  }
}

async function saveConfig() {
  try {
    const payload = {
      model: document.getElementById("model").value,
      temperature: parseFloat(document.getElementById("temperature").value),
      maxMemory: parseInt(document.getElementById("maxMemory").value),
      cooldownMs: parseInt(document.getElementById("cooldownMs").value),
      maxTokens: parseInt(document.getElementById("maxTokens").value),
      languageMode: document.getElementById("languageMode").value,
      defaultLanguage: document.getElementById("defaultLanguage").value,
      timeZone: document.getElementById("timeZone").value,
      location: document.getElementById("location").value,
      intensionMode: document.getElementById("intensionMode").value
    };

    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    alert("✅ Settings saved!");
  } catch (err) {
    alert("❌ Failed to save settings.");
    console.error(err);
  }
}

// ---------------- PROMPTS / CHARACTER ----------------
async function loadPrompt() {
  try {
    const res = await fetch("/api/prompts");
    const data = await res.json();
    const activeKey = data.activePrompt || "default";

    document.getElementById("activePromptKey").value = activeKey;
    document.getElementById("promptText").value = data.prompts?.[activeKey]?.prompt || "";
  } catch (err) {
    console.error("Failed to load prompts:", err);
  }
}

async function savePrompt() {
  try {
    const key = document.getElementById("activePromptKey").value.trim();
    const prompt = document.getElementById("promptText").value.trim();

    await fetch(`/api/prompts/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    alert("✅ Character saved!");
  } catch (err) {
    alert("❌ Failed to save character.");
    console.error(err);
  }
}

// ---------------- PROFILES ----------------
async function loadProfiles() {
  try {
    const res = await fetch("/api/profiles");
    const data = await res.json();

    document.getElementById("botProfile").value = formatProfileText(data.botProfile);
    document.getElementById("userProfile").value = formatProfileText(data.userProfile);
  } catch (err) {
    console.error("Failed to load profiles:", err);
  }
}

async function saveProfiles() {
  try {
    const payload = {
      botProfile: parseProfileText(document.getElementById("botProfile").value),
      userProfile: parseProfileText(document.getElementById("userProfile").value)
    };

    await fetch("/api/profiles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    alert("✅ Profiles saved!");
  } catch (err) {
    alert("❌ Failed to save profiles.");
    console.error(err);
  }
}

function formatProfileText(obj) {
  if (!obj) return "";
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");
}

function parseProfileText(text) {
  const obj = {};
  if (!text) return obj;

  const lines = text.split("\n");
  for (let line of lines) {
    const [key, ...rest] = line.split(":");
    if (!key) continue;
    let value = rest.join(":").trim();
    if (value.includes(",")) value = value.split(",").map(s => s.trim());
    obj[key.trim()] = value;
  }
  return obj;
}

// ---------------- MEMORY ----------------
async function loadMemory() {
  try {
    const res = await fetch("/api/memory");
    const data = await res.json();

    let output = "";
    for (const key in data) {
      output += `${key}\n`;
      data[key].forEach(msg => {
        output += `role: ${msg.role}\n`;
        output += `content: ${msg.content}\n\n`;
      });
    }

    document.getElementById("memoryBox").value = output.trim();
  } catch (err) {
    console.error("Failed to load memory:", err);
  }
}

async function saveMemory() {
  const content = document.getElementById("memoryBox").value.trim();

  try {
    const lines = content.split("\n");
    let rebuilt = {};
    let currentKey = null;
    let currentMsgs = [];
    let currentMsg = {};

    lines.forEach(line => {
      if (!line.trim()) return;

      if (!line.startsWith("role:") && !line.startsWith("content:")) {
        if (currentKey) rebuilt[currentKey] = currentMsgs;
        currentKey = line.trim();
        currentMsgs = [];
        currentMsg = {};
      } else if (line.startsWith("role:")) {
        currentMsg.role = line.replace("role:", "").trim();
      } else if (line.startsWith("content:")) {
        currentMsg.content = line.replace("content:", "").trim();
        currentMsgs.push(currentMsg);
        currentMsg = {};
      }
    });

    if (currentKey) rebuilt[currentKey] = currentMsgs;

    await fetch("/api/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rebuilt)
    });

    alert("✅ Memory saved!");
  } catch (err) {
    alert("❌ Failed to save memory.");
    console.error(err);
  }
}

async function clearAllMemory() {
  try {
    await fetch("/api/memory", { method: "DELETE" });
    alert("🧠 All memory cleared!");
    loadMemory();
  } catch (err) {
    alert("❌ Failed to clear memory.");
    console.error(err);
  }
}

// ---------------- INIT ----------------
document.addEventListener("DOMContentLoaded", () => {
  showTab("settings"); // default tab
  loadConfig();
  loadPrompt();
  loadProfiles();
  loadMemory();
});