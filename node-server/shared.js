// node-server/shared.js
// Central export of models, middleware and helpers used by all route files.
// server.js must call mongoose.connect() BEFORE any route handler runs;
// mongoose queues operations until the connection is ready, so model
// definitions here are safe even though connect() lives in server.js.

const mongoose = require("mongoose");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");
const { getModePrompt } = require("./prompts");

// ============================================================
//  MODELS
// ============================================================

const UserSchema = new mongoose.Schema({
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: false },
    name:     { type: String, default: "User" },
    age:      { type: Number, required: false },
    googleId: { type: String, unique: true, sparse: true },
    nickname: { type: String, default: "" },
    address:  { type: String, default: "" },
    userType: { type: String, enum: ["personal","developer","student","business","researcher"], default: "personal" },
    status:   { type: String, enum: ["online","busy","away"], default: "online" },
    avatar:   { type: String, default: "" },
    mode:     { type: String, default: "default" },
    tokensUsed:    { type: Number, default: 0 },
    tokenLimit:    { type: Number, default: 100000 },
    messagesCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    permissions: {
        canWebSearch:   { type: Boolean, default: true },
        canRunCode:     { type: Boolean, default: true },
        canCreateFiles: { type: Boolean, default: true },
        canSetAlarms:   { type: Boolean, default: true },
        canPlayMusic:   { type: Boolean, default: true },
        canGetNews:     { type: Boolean, default: true }
    },
    // ── Points / billing ──────────────────────────────────────
    role:               { type: String, enum: ["user", "admin"], default: "user" },
    points:             { type: Number, default: 500 },    // persistent currency (not daily)
    lastDailyReset:     { type: Date,   default: Date.now },
    weightedTokensUsed: { type: Number, default: 0 }       // lifetime weighted cost (for stats)
});
const User = mongoose.model("User", UserSchema);

const PointsRequestSchema = new mongoose.Schema({
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email:       { type: String, default: "" },
    name:        { type: String, default: "" },
    amount:      { type: Number, required: true },
    reason:      { type: String, default: "" },
    status:      { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminNote:   { type: String, default: "" },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt:  { type: Date }
});
const PointsRequest = mongoose.model("PointsRequest", PointsRequestSchema);

const OTPSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp:   { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 }
});
const OTP = mongoose.model("OTP", OTPSchema);

const SessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title:  String,
    createdAt: { type: Date, default: Date.now }
});
const Session = mongoose.model("Session", SessionSchema);

const AssistantSchema = new mongoose.Schema({
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name:         { type: String, default: "Anya" },
    tone:         { type: String, default: "warm, intelligent, supportive" },
    relationship: { type: String, default: "close trusted friend" },
    behavior:     { type: String, default: "helpful, emotionally aware, slightly playful but professional when needed" }
});
const Assistant = mongoose.model("Assistant", AssistantSchema);

const MessageSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sessionId: String,
    role:      String,
    content:   String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", MessageSchema);

const MEMORY_LIMIT = 15;

// ============================================================
//  AUTH CONSTANTS + TRANSPORT
// ============================================================

const jwtSecret = process.env.JWT_SECRET || "anya_secret_key";
const oAuth2Client = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID);

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ============================================================
//  EMAIL HELPERS
// ============================================================

function buildWelcomeEmail(name) {
    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="520" style="background:#1a1a2e;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed 0%,#ec4899 100%);padding:36px 40px;text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">✦</div>
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Welcome to Anya AI</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Your intelligent AI assistant is ready</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="color:#e2e8f0;font-size:16px;margin:0 0 20px;">Hey <strong style="color:#a78bfa;">${name}</strong> 👋</p>
          <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">You're all set! Anya is your personal AI assistant — ask her anything, set timers, check the weather, play music, take notes, and much more.</p>
          <table width="100%" style="background:#0f0f13;border-radius:12px;padding:20px;margin-bottom:24px;">
            <tr><td>
              <p style="color:#a78bfa;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 14px;">What you can do</p>
              <p style="color:#94a3b8;font-size:14px;margin:6px 0;">🌦 &nbsp;<strong style="color:#e2e8f0;">Weather</strong> — Real-time forecasts for any city</p>
              <p style="color:#94a3b8;font-size:14px;margin:6px 0;">⏳ &nbsp;<strong style="color:#e2e8f0;">Timers & Alarms</strong> — Just ask in natural language</p>
              <p style="color:#94a3b8;font-size:14px;margin:6px 0;">🎵 &nbsp;<strong style="color:#e2e8f0;">Music</strong> — Play any song from YouTube</p>
              <p style="color:#94a3b8;font-size:14px;margin:6px 0;">📝 &nbsp;<strong style="color:#e2e8f0;">Notes & Tasks</strong> — Remember anything for you</p>
              <p style="color:#94a3b8;font-size:14px;margin:6px 0;">🔍 &nbsp;<strong style="color:#e2e8f0;">Web Search</strong> — Live answers to any question</p>
            </td></tr>
          </table>
          <p style="color:#64748b;font-size:12px;margin:0;">This email was sent because you just created an Anya AI account. If you didn't do this, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="background:#12121e;padding:20px 40px;text-align:center;">
          <p style="color:#334155;font-size:12px;margin:0;">Anya AI &nbsp;·&nbsp; Your local intelligent assistant</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildOTPEmail(name, otp) {
    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="480" style="background:#1a1a2e;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#3730a3 100%);padding:30px 40px;text-align:center;">
          <div style="font-size:36px;margin-bottom:6px;">🔐</div>
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Your Login Code</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Anya AI — Secure Login</p>
        </td></tr>
        <tr><td style="padding:36px 40px;text-align:center;">
          <p style="color:#94a3b8;font-size:15px;margin:0 0 28px;text-align:left;">Hi <strong style="color:#e2e8f0;">${name || 'there'}</strong>, here is your one-time login code for Anya AI:</p>
          <div style="background:#0f0f13;border:2px solid #4f46e5;border-radius:14px;padding:28px;margin-bottom:28px;">
            <p style="margin:0 0 6px;color:#6366f1;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">One-Time Code</p>
            <p style="margin:0;color:#a78bfa;font-size:42px;font-weight:800;letter-spacing:12px;font-family:'Courier New',monospace;">${otp}</p>
          </div>
          <table width="100%" style="background:#1e1034;border-radius:10px;padding:16px;margin-bottom:24px;">
            <tr><td>
              <p style="margin:0;color:#94a3b8;font-size:13px;">⏱ &nbsp;This code expires in <strong style="color:#e2e8f0;">5 minutes</strong></p>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">🔒 &nbsp;Never share this code with anyone</p>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">🚫 &nbsp;Anya AI will never ask for it verbally</p>
            </td></tr>
          </table>
          <p style="color:#475569;font-size:12px;text-align:left;margin:0;">If you didn't request this, someone may have entered your email by mistake. You can safely ignore this email — your account is secure.</p>
        </td></tr>
        <tr><td style="background:#12121e;padding:18px 40px;text-align:center;">
          <p style="color:#334155;font-size:12px;margin:0;">Anya AI &nbsp;·&nbsp; Your local intelligent assistant</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to, subject, html) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log("[EMAIL] Mailer not configured. Skipping send to:", to);
        return;
    }
    try {
        await transporter.sendMail({ from: `"Anya AI" <${process.env.EMAIL_USER}>`, to, subject, html });
        console.log(`[EMAIL] Sent '${subject}' to ${to}`);
    } catch (err) {
        console.error("[EMAIL] Failed to send:", err.message);
    }
}

// ============================================================
//  AUTH MIDDLEWARE
// ============================================================

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized: No token provided" });
    const token = authHeader.split(" ")[1];
    try {
        req.user = jwt.verify(token, jwtSecret);
        next();
    } catch (err) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
};

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        try {
            req.user = jwt.verify(authHeader.split(" ")[1], jwtSecret);
        } catch (err) { }
    }
    next();
};

const adminMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    try {
        req.user = jwt.verify(token, jwtSecret);
        if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
        next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
};

// ============================================================
//  AI HELPERS
// ============================================================

async function ensureAssistantExists() {
    const existing = await Assistant.findOne();
    if (!existing) {
        await Assistant.create({});
        console.log("Default Anya created.");
    }
}

async function buildSystemPrompt() {
    const assistant = await Assistant.findOne();
    return `
    if normal conversation then respond normally
    if a tool is needed then respond with ONLY valid JSON — no text, no markdown, no explanation.
==============================
STRICT TOOL MODE
==============================
When a tool is needed, respond with ONLY valid JSON — no text, no markdown, no explanation.

FORMAT:
{ "type": "tool", "tool": "tool_name", "parameters": {} }

==============================
TOOL REFERENCE
==============================

WEATHER — user asks about weather, temperature, forecast:
{ "type": "tool", "tool": "get_weather", "parameters": { "location": "city name" } }

TIMER — duration is ALWAYS in seconds. Convert before sending:
  "30 seconds" → 30 | "5 minutes" → 300 | "1 hour" → 3600 | "2h 30m" → 9000
{ "type": "tool", "tool": "start_timer", "parameters": { "duration": 300 } }
Pause:  { "type": "tool", "tool": "start_timer", "parameters": { "action": "pause" } }
Resume: { "type": "tool", "tool": "start_timer", "parameters": { "action": "resume" } }
Reset:  { "type": "tool", "tool": "start_timer", "parameters": { "action": "reset" } }

ALARM — user wants an alarm at a specific clock time:
{ "type": "tool", "tool": "set_alarm", "parameters": { "time": "HH:MM", "label": "label" } }
  "set alarm for 6pm" → { "time": "18:00", "label": "Alarm" }
  "wake me at 7:30 AM" → { "time": "07:30", "label": "Wake up" }

CLOCK / TIME — user asks what time it is:
  Local: { "type": "tool", "tool": "show_clock", "parameters": {} }
  City:  { "type": "tool", "tool": "show_clock", "parameters": { "city": "Tokyo", "timezone": "Asia/Tokyo" } }
  Always include the IANA timezone if you know it.

STOPWATCH — user asks to open or start a stopwatch:
{ "type": "tool", "tool": "open_stopwatch", "parameters": {} }

MUSIC — user wants to play a song or music:
{ "type": "tool", "tool": "play_music", "parameters": { "query": "song name or artist" } }

INTERNET SPEED — user asks about internet speed, network speed, bandwidth, or ping:
{ "type": "tool", "tool": "open_netspeed", "parameters": {} }
NEVER do a web search for this — always use the open_netspeed tool.

NOTES / REMINDERS — user says "remember", "note that", "save", "don't forget", gives a task, phone number, or fact:
{ "type": "tool", "tool": "add_note", "parameters": { "text": "text to save", "type": "TYPE" } }
  TYPE rules:
  - "todo"     → "I need to", "I have to", "task", "project"
  - "reminder" → future event, date, or time context ("tomorrow", "at 2pm", "next week")
  - "phone"    → phone number or contact info
  - "note"     → everything else (facts, taglines, API keys, general info)

FILES — user wants to create, edit, read, or delete a file:
  Create: { "type": "tool", "tool": "file_tool", "parameters": { "action": "create", "fileName": "name.py", "content": "..." } }
  Edit:   { "type": "tool", "tool": "file_tool", "parameters": { "action": "edit", "fileName": "name.py", "content": "..." } }
  Read:   { "type": "tool", "tool": "file_tool", "parameters": { "action": "read", "fileName": "name.py" } }
  Delete: { "type": "tool", "tool": "file_tool", "parameters": { "action": "delete", "fileName": "name.py" } }

WEB SEARCH — user asks to search, look up, find info about current events, news, people, places, or any factual question you can't answer from training:
{ "type": "tool", "tool": "web_search", "parameters": { "query": "search terms" } }
Do NOT use this for weather, music, files, time, speed, notes — those have dedicated tools.

CODE RUNNER — user asks to run, execute, or test code:
{ "type": "tool", "tool": "run_code", "parameters": { "code": "python code here", "language": "python" } }
Only Python is supported. Extract code exactly as given. Never add dangerous imports.

==============================
If no tool is needed, respond normally and naturally.
==============================

You are ${assistant.name}.
Personality — Tone: ${assistant.tone} | Relationship: ${assistant.relationship} | Behavior: ${assistant.behavior}
`;
}

async function buildConversationHistory(sessionId) {
    const messages = await Message.find({ sessionId })
        .sort({ timestamp: -1 })
        .limit(MEMORY_LIMIT);
    const ordered = messages.reverse();
    let historyText = "";
    ordered.forEach(msg => {
        historyText += msg.role === "user"
            ? `User: ${msg.content}\n`
            : `Assistant: ${msg.content}\n`;
    });
    return historyText;
}

// ============================================================
//  EXPORTS
// ============================================================

module.exports = {
    // Models
    User, OTP, Session, Message, Assistant, PointsRequest,
    MEMORY_LIMIT,
    // Auth
    jwtSecret, oAuth2Client, bcrypt, jwt,
    authMiddleware, optionalAuth, adminMiddleware,
    // Email
    transporter, buildWelcomeEmail, buildOTPEmail, sendEmail,
    // AI helpers
    buildSystemPrompt, buildConversationHistory, ensureAssistantExists,
    getModePrompt
};
