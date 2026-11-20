// node-server/routes/auth.js
const router = require("express").Router();
const {
    User, OTP,
    bcrypt, jwt, jwtSecret, oAuth2Client,
    authMiddleware,
    sendEmail, buildWelcomeEmail, buildOTPEmail
} = require("../shared");

// Helper: auto-promote to admin if email matches ADMIN_EMAIL env var
async function resolveRole(user) {
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    if (adminEmail && user.email.toLowerCase() === adminEmail && user.role !== "admin") {
        user.role = "admin";
        await user.save();
    }
    return user.role || "user";
}

// ---- Signup ----
router.post("/api/auth/signup", async (req, res) => {
    try {
        const { email, password, name, age } = req.body;
        if (!email || !password || !name || !age)
            return res.status(400).json({ error: "All fields are required" });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ email, password: hashedPassword, name, age });
        const role = await resolveRole(user);

        const token = jwt.sign({ userId: user._id, email: user.email, role }, jwtSecret, { expiresIn: "7d" });

        sendEmail(email, `Welcome to Anya AI, ${name}! ✦`, buildWelcomeEmail(name));

        res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, age: user.age, role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Login ----
router.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !user.password)
            return res.status(400).json({ error: "User not found or logged in with Google" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        const role = await resolveRole(user);
        const token = jwt.sign({ userId: user._id, email: user.email, role }, jwtSecret, { expiresIn: "7d" });
        res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, age: user.age, role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Google OAuth ----
router.post("/api/auth/google", async (req, res) => {
    try {
        const { credential } = req.body;
        const ticket = await oAuth2Client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_OAUTH_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;

        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({ email, name, googleId });
        } else if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }

        const role = await resolveRole(user);
        const token = jwt.sign({ userId: user._id, email: user.email, role }, jwtSecret, { expiresIn: "7d" });
        res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, age: user.age, role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Send OTP ----
router.post("/api/auth/send-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "No account found with this email" });

        const recent = await OTP.findOne({ email });
        if (recent) {
            const ageSeconds = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
            if (ageSeconds < 60) {
                const waitSecs = Math.ceil(60 - ageSeconds);
                return res.status(429).json({ error: `Please wait ${waitSecs} seconds before requesting a new code.` });
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.deleteMany({ email });
        await OTP.create({ email, otp });

        sendEmail(email, `Your Anya AI Login Code: ${otp}`, buildOTPEmail(user.name, otp));

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log("[OTP] Mailer not configured. OTP for", email, "is:", otp);
        }

        res.json({ success: true, message: "Code sent to your email" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Login with OTP ----
router.post("/api/auth/login-with-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

        const record = await OTP.findOne({ email, otp });
        if (!record) return res.status(400).json({ error: "Invalid or expired OTP" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        await OTP.deleteMany({ email });

        const role = await resolveRole(user);
        const token = jwt.sign({ userId: user._id, email: user.email, role }, jwtSecret, { expiresIn: "7d" });
        res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, age: user.age, role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Verify password (re-auth) ----
router.post("/api/auth/verify-password", authMiddleware, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: "Password is required" });

        const user = await User.findById(req.user.userId);
        if (!user || !user.password)
            return res.status(400).json({ error: "No password set (Google account)" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect password" });

        res.json({ success: true, message: "Identity verified" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Change password ----
router.post("/api/auth/change-password", authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: "Both current and new password are required" });
        if (newPassword.length < 6)
            return res.status(400).json({ error: "New password must be at least 6 characters" });

        const user = await User.findById(req.user.userId);
        if (!user || !user.password)
            return res.status(400).json({ error: "No password set (Google account)" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: "Current password is incorrect" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
