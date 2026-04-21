/**
 * Openclaw Setup UI
 * - Single admin (1 password, set lần đầu khi mở /setup)
 * - Edit openclaw.json (bot-home volume) + db.json (router-data volume)
 * - Restart container qua docker.sock
 * - Mount sau nginx tại /setup (không expose port ra host)
 */
"use strict";

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

// --- Paths ---
const BOT_CONFIG   = "/data/openclaw/openclaw.json";
const ROUTER_DB    = "/data/9router/db.json";
const AUTH_FILE    = "/data/setup/auth.json";
const AUTH_DIR     = path.dirname(AUTH_FILE);

// --- App ---
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use("/setup/static", express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

app.use(session({
  name: "openclaw.sid",
  secret: process.env.SESSION_SECRET || "change-me-in-env",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 }
}));

// --- Helpers ---
function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fallback; }
}
function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}
function getAuth() {
  if (!fs.existsSync(AUTH_FILE)) return null;
  return readJSON(AUTH_FILE, null);
}
function setAuth(passwordPlain) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const hash = bcrypt.hashSync(passwordPlain, 10);
  writeJSON(AUTH_FILE, { passwordHash: hash, createdAt: new Date().toISOString() });
}
function dockerRestart(container) {
  return new Promise((resolve, reject) => {
    execFile("docker", ["restart", container], { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}
function dockerPs() {
  return new Promise((resolve) => {
    execFile("docker", ["ps", "--format", "{{.Names}}|{{.Status}}"], { timeout: 10000 },
      (err, stdout) => resolve(err ? "" : stdout));
  });
}

// --- Middleware ---
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  return res.redirect("/setup/login");
}
function requireSetup(req, res, next) {
  const auth = getAuth();
  if (!auth) return res.redirect("/setup/first-run");
  next();
}

// --- Base path behind nginx: /setup ---
const R = express.Router();

// First-run: set password
R.get("/first-run", (req, res) => {
  if (getAuth()) return res.redirect("/setup/login");
  res.render("first-run", { error: null });
});
R.post("/first-run", (req, res) => {
  if (getAuth()) return res.redirect("/setup/login");
  const { password, confirm } = req.body;
  if (!password || password.length < 6)
    return res.render("first-run", { error: "Mật khẩu tối thiểu 6 ký tự." });
  if (password !== confirm)
    return res.render("first-run", { error: "Mật khẩu nhập lại không khớp." });
  setAuth(password);
  req.session.user = "admin";
  res.redirect("/setup");
});

// Login
R.get("/login", requireSetup, (req, res) => {
  res.render("login", { error: null });
});
R.post("/login", requireSetup, (req, res) => {
  const auth = getAuth();
  if (!auth) return res.redirect("/setup/first-run");
  if (!bcrypt.compareSync(req.body.password || "", auth.passwordHash)) {
    return res.render("login", { error: "Sai mật khẩu." });
  }
  req.session.user = "admin";
  res.redirect("/setup");
});
R.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/setup/login"));
});

// Dashboard
R.get("/", requireSetup, requireAuth, async (req, res) => {
  const ps = await dockerPs();
  const containers = ps.split("\n").filter(Boolean).map(line => {
    const [name, status] = line.split("|");
    return { name, status };
  });
  res.render("dashboard", { containers, flash: req.session.flash || null });
  req.session.flash = null;
});

// General tab
R.get("/general", requireSetup, requireAuth, (req, res) => {
  const cfg = readJSON(BOT_CONFIG, {});
  const agent = (cfg.agents && cfg.agents.chat) || {};
  res.render("general", {
    botName: agent.name || "",
    systemPrompt: agent.systemPrompt || "",
    model: agent.model || "9router/gemini/gemini-2.5-flash",
    flash: req.session.flash || null
  });
  req.session.flash = null;
});
R.post("/general", requireSetup, requireAuth, (req, res) => {
  const cfg = readJSON(BOT_CONFIG, {});
  cfg.agents = cfg.agents || {};
  cfg.agents.chat = cfg.agents.chat || {};
  cfg.agents.chat.name = req.body.botName || "Jessica";
  cfg.agents.chat.systemPrompt = req.body.systemPrompt || "";
  cfg.agents.chat.model = req.body.model || "9router/gemini/gemini-2.5-flash";
  writeJSON(BOT_CONFIG, cfg);
  req.session.flash = { type: "ok", msg: "Đã lưu. Nhấn 'Restart bot' để áp dụng." };
  res.redirect("/setup/general");
});

// Providers (9router)
R.get("/providers", requireSetup, requireAuth, (req, res) => {
  const db = readJSON(ROUTER_DB, { providerConnections: [] });
  res.render("providers", {
    providers: db.providerConnections || [],
    flash: req.session.flash || null
  });
  req.session.flash = null;
});
R.post("/providers/add", requireSetup, requireAuth, (req, res) => {
  const db = readJSON(ROUTER_DB, { providerConnections: [] });
  db.providerConnections = db.providerConnections || [];
  db.providerConnections.push({
    id: "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
    provider: req.body.provider,
    authType: "apikey",
    name: req.body.name || req.body.provider,
    priority: parseInt(req.body.priority || "1", 10),
    isActive: true,
    apiKey: req.body.apiKey || "",
    providerSpecificData: {
      connectionProxyEnabled: false, connectionProxyUrl: "", connectionNoProxy: ""
    },
    createdAt: new Date().toISOString()
  });
  writeJSON(ROUTER_DB, db);
  req.session.flash = { type: "ok", msg: "Đã thêm provider. Nhấn 'Restart 9router' để áp dụng." };
  res.redirect("/setup/providers");
});
R.post("/providers/:id/delete", requireSetup, requireAuth, (req, res) => {
  const db = readJSON(ROUTER_DB, { providerConnections: [] });
  db.providerConnections = (db.providerConnections || []).filter(p => p.id !== req.params.id);
  writeJSON(ROUTER_DB, db);
  req.session.flash = { type: "ok", msg: "Đã xoá provider." };
  res.redirect("/setup/providers");
});
R.post("/providers/:id/toggle", requireSetup, requireAuth, (req, res) => {
  const db = readJSON(ROUTER_DB, { providerConnections: [] });
  const p = (db.providerConnections || []).find(x => x.id === req.params.id);
  if (p) p.isActive = !p.isActive;
  writeJSON(ROUTER_DB, db);
  res.redirect("/setup/providers");
});

// Channels
R.get("/channels", requireSetup, requireAuth, (req, res) => {
  const cfg = readJSON(BOT_CONFIG, {});
  const ch = cfg.channels || {};
  res.render("channels", {
    zaloEnabled: !!(ch.zalouser && ch.zalouser.enabled),
    telegramEnabled: !!(ch.telegram && ch.telegram.enabled),
    telegramToken: (ch.telegram && ch.telegram.token) || "",
    flash: req.session.flash || null
  });
  req.session.flash = null;
});
R.post("/channels", requireSetup, requireAuth, (req, res) => {
  const cfg = readJSON(BOT_CONFIG, {});
  cfg.channels = cfg.channels || {};
  cfg.channels.zalouser = cfg.channels.zalouser || {};
  cfg.channels.zalouser.enabled = req.body.zaloEnabled === "on";
  cfg.channels.telegram = cfg.channels.telegram || {};
  cfg.channels.telegram.enabled = req.body.telegramEnabled === "on";
  cfg.channels.telegram.token = req.body.telegramToken || "";
  writeJSON(BOT_CONFIG, cfg);
  req.session.flash = { type: "ok", msg: "Đã lưu channels. Nhấn 'Restart bot'." };
  res.redirect("/setup/channels");
});

// Memory
R.get("/memory", requireSetup, requireAuth, (req, res) => {
  const cfg = readJSON(BOT_CONFIG, {});
  const enabled = Array.isArray(cfg.plugins && cfg.plugins.enabled)
    ? cfg.plugins.enabled : [];
  const coreCron = cfg.plugins?.config?.["memory-core"]?.dreaming?.cron || "0 3 * * *";
  res.render("memory", {
    activeMemoryOn: enabled.includes("active-memory"),
    memoryCoreOn: enabled.includes("memory-core"),
    coreCron,
    flash: req.session.flash || null
  });
  req.session.flash = null;
});
R.post("/memory", requireSetup, requireAuth, (req, res) => {
  const cfg = readJSON(BOT_CONFIG, {});
  cfg.plugins = cfg.plugins || {};
  const wantCore = req.body.memoryCoreOn === "on";
  const wantActive = req.body.activeMemoryOn === "on";
  const enabled = new Set(cfg.plugins.enabled || []);
  wantCore ? enabled.add("memory-core") : enabled.delete("memory-core");
  wantActive ? enabled.add("active-memory") : enabled.delete("active-memory");
  cfg.plugins.enabled = [...enabled];
  cfg.plugins.slots = cfg.plugins.slots || {};
  if (wantCore) cfg.plugins.slots.memory = "memory-core";
  cfg.plugins.config = cfg.plugins.config || {};
  cfg.plugins.config["memory-core"] = cfg.plugins.config["memory-core"] || {};
  cfg.plugins.config["memory-core"].dreaming = cfg.plugins.config["memory-core"].dreaming || {};
  cfg.plugins.config["memory-core"].dreaming.cron = req.body.coreCron || "0 3 * * *";
  cfg.plugins.config["memory-core"].dreaming.timezone = "Asia/Ho_Chi_Minh";
  writeJSON(BOT_CONFIG, cfg);
  req.session.flash = { type: "ok", msg: "Đã lưu memory. Nhấn 'Restart bot'." };
  res.redirect("/setup/memory");
});

// Actions
R.post("/action/restart/:target", requireSetup, requireAuth, async (req, res) => {
  const map = {
    bot: "openclaw-bot",
    "9router": "openclaw-9router",
    zalo: "openclaw-zalo",
    nginx: "openclaw-nginx"
  };
  const c = map[req.params.target];
  if (!c) { req.session.flash = { type: "err", msg: "Target không hợp lệ." }; return res.redirect("/setup"); }
  try {
    await dockerRestart(c);
    req.session.flash = { type: "ok", msg: `Đã restart ${c}.` };
  } catch (e) {
    req.session.flash = { type: "err", msg: `Restart fail: ${e.message}` };
  }
  res.redirect("/setup");
});

// Change password
R.get("/password", requireSetup, requireAuth, (req, res) =>
  res.render("password", { flash: req.session.flash || null, error: null }));
R.post("/password", requireSetup, requireAuth, (req, res) => {
  const auth = getAuth();
  if (!bcrypt.compareSync(req.body.current || "", auth.passwordHash))
    return res.render("password", { flash: null, error: "Mật khẩu hiện tại sai." });
  if (!req.body.next || req.body.next.length < 6)
    return res.render("password", { flash: null, error: "Mật khẩu mới tối thiểu 6 ký tự." });
  if (req.body.next !== req.body.confirm)
    return res.render("password", { flash: null, error: "Mật khẩu nhập lại không khớp." });
  setAuth(req.body.next);
  req.session.flash = { type: "ok", msg: "Đã đổi mật khẩu." };
  res.redirect("/setup");
});

app.use("/setup", R);
app.get("/", (req, res) => res.redirect("/setup"));

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[setup] listening on ${PORT}`);
});
