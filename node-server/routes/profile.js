// node-server/routes/profile.js
const router = require("express").Router();
const { User, PointsRequest, authMiddleware } = require("../shared");
const { TOKENS_PER_POINT } = require("../services/modelConfig");

// Helper: run daily reset if the calendar day has changed (resets tokensUsed only)
async function applyDailyReset(user) {
    if (user.role === "admin") return user;
    const today = new Date().toDateString();
    if (!user.lastDailyReset || new Date(user.lastDailyReset).toDateString() !== today) {
        user.tokensUsed    = 0;
        user.lastDailyReset = new Date();
        await user.save();
    }
    return user;
}

// ---- Get profile ----
router.get("/api/profile", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("-password -__v");
        if (!user) return res.status(404).json({ error: "User not found" });

        await applyDailyReset(user);

        res.json({
            id:           user._id,
            email:        user.email,
            name:         user.name,
            age:          user.age,
            nickname:     user.nickname,
            address:      user.address,
            userType:     user.userType,
            status:       user.status,
            avatar:       user.avatar,
            mode:         user.mode,
            role:         user.role || "user",
            tokensUsed:   user.tokensUsed,
            tokenLimit:   user.tokenLimit,
            tokensLeft:   Math.max(0, user.tokenLimit - user.tokensUsed),
            messagesCount: user.messagesCount,
            createdAt:    user.createdAt,
            permissions:  user.permissions,
            // Points currency (null for admin — no limits)
            points:             user.role === "admin" ? null : (user.points ?? 500),
            weightedTokensUsed: user.weightedTokensUsed || 0,
            lastDailyReset:     user.lastDailyReset
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Update profile ----
router.put("/api/profile", authMiddleware, async (req, res) => {
    try {
        const allowed = ["name", "nickname", "address", "userType", "status", "avatar", "mode"];
        const updates = {};
        allowed.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select("-password -__v");
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json({
            success: true,
            user: {
                id: user._id, email: user.email, name: user.name, age: user.age,
                nickname: user.nickname, address: user.address, userType: user.userType,
                status: user.status, avatar: user.avatar, mode: user.mode,
                tokensUsed: user.tokensUsed, tokenLimit: user.tokenLimit,
                tokensLeft: Math.max(0, user.tokenLimit - user.tokensUsed),
                messagesCount: user.messagesCount, createdAt: user.createdAt
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Update permissions ----
router.patch("/api/profile/permissions", authMiddleware, async (req, res) => {
    try {
        const allowed = ["canWebSearch", "canRunCode", "canCreateFiles", "canSetAlarms", "canPlayMusic", "canGetNews"];
        const updates = {};
        allowed.forEach(key => {
            if (typeof req.body[key] === "boolean") updates[`permissions.${key}`] = req.body[key];
        });

        if (Object.keys(updates).length === 0)
            return res.status(400).json({ error: "No valid permission fields provided." });

        const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select("permissions");
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json({ ok: true, permissions: user.permissions });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Get current points + token balance ----
router.get("/api/user/points", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("role points tokenLimit tokensUsed lastDailyReset weightedTokensUsed");
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.role === "admin") return res.json({ admin: true });

        await applyDailyReset(user);

        res.json({
            points:             user.points ?? 500,
            tokenLimit:         user.tokenLimit || 100000,
            tokensUsed:         user.tokensUsed || 0,
            tokensLeft:         Math.max(0, (user.tokenLimit || 100000) - user.tokensUsed),
            weightedTokensUsed: user.weightedTokensUsed || 0,
            tokensPerPoint:     TOKENS_PER_POINT
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Redeem points for bonus tokens ----
// 1 point = TOKENS_PER_POINT tokens added to tokenLimit (permanent until used)
router.post("/api/user/redeem-points", authMiddleware, async (req, res) => {
    try {
        const { points } = req.body;
        if (!points || isNaN(Number(points)) || Number(points) <= 0)
            return res.status(400).json({ error: "Amount must be a positive number" });

        const cost = Number(points);
        const user = await User.findById(req.user.userId).select("role points tokenLimit");
        if (!user) return res.status(404).json({ error: "User not found" });
        if (user.role === "admin") return res.status(400).json({ error: "Admins have no token restrictions" });
        if ((user.points ?? 0) < cost) return res.status(400).json({ error: "Insufficient points" });

        const tokensGained = cost * TOKENS_PER_POINT;
        user.points     -= cost;
        user.tokenLimit += tokensGained;
        await user.save();

        res.json({
            ok: true,
            tokensGained,
            newTokenLimit: user.tokenLimit,
            newPoints:     user.points
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Submit points request (ask admin for more points) ----
router.post("/api/user/request-points", authMiddleware, async (req, res) => {
    try {
        const { amount, reason } = req.body;
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
            return res.status(400).json({ error: "Amount must be a positive number" });

        const user = await User.findById(req.user.userId).select("email name role");
        if (!user) return res.status(404).json({ error: "User not found" });
        if (user.role === "admin") return res.status(400).json({ error: "Admins don't need points" });

        const request = await PointsRequest.create({
            userId: req.user.userId,
            email:  user.email,
            name:   user.name || "",
            amount: Number(amount),
            reason: (reason || "").slice(0, 500)
        });

        res.json({ ok: true, request });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
