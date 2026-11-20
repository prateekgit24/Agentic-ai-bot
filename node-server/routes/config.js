// node-server/routes/config.js
const router = require("express").Router();

// ---- Voice config ----
router.get("/config/voice", (req, res) => {
    res.json({ picovoiceKey: process.env.PICOVOICE_ACCESS_KEY || "" });
});

// ---- Google OAuth client ID ----
router.get("/config/google", (req, res) => {
    res.json({ clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "" });
});

module.exports = router;
