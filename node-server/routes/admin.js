// node-server/routes/admin.js
const router = require("express").Router();
const {
    User, PointsRequest, adminMiddleware
} = require("../shared");

// ------------------------------------------------------------------
//  GET /api/admin/stats  — aggregate platform stats
// ------------------------------------------------------------------
router.get("/api/admin/stats", adminMiddleware, async (req, res) => {
    try {
        const [totalUsers, totalMessages, weightedResult] = await Promise.all([
            User.countDocuments(),
            User.aggregate([{ $group: { _id: null, total: { $sum: "$messagesCount" } } }]),
            User.aggregate([{ $group: { _id: null, total: { $sum: "$weightedTokensUsed" } } }])
        ]);
        res.json({
            totalUsers,
            totalMessages:       totalMessages[0]?.total    || 0,
            totalWeightedTokens: weightedResult[0]?.total   || 0
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ------------------------------------------------------------------
//  GET /api/admin/users  — list all users with key stats
// ------------------------------------------------------------------
router.get("/api/admin/users", adminMiddleware, async (req, res) => {
    try {
        const users = await User.find()
            .select("email name role points tokenLimit tokensUsed weightedTokensUsed messagesCount createdAt lastDailyReset")
            .sort({ createdAt: -1 })
            .lean();
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ------------------------------------------------------------------
//  PATCH /api/admin/users/:id/points
//  Adjust user's points (currency) and/or tokenLimit (daily cap).
//  Body: { points?: number, tokenLimit?: number, resetTokens?: boolean }
//    • points      — sets the user's point balance to this value
//    • tokenLimit  — sets the user's daily token cap
//    • resetTokens — if true, resets tokensUsed to 0 immediately
// ------------------------------------------------------------------
router.patch("/api/admin/users/:id/points", adminMiddleware, async (req, res) => {
    try {
        const { points, tokenLimit, resetTokens } = req.body;
        const updates = {};

        if (points      !== undefined) updates.points      = Number(points);
        if (tokenLimit  !== undefined) updates.tokenLimit  = Number(tokenLimit);
        if (resetTokens) {
            updates.tokensUsed    = 0;
            updates.lastDailyReset = new Date();
        }

        if (Object.keys(updates).length === 0)
            return res.status(400).json({ error: "Nothing to update." });

        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
            .select("_id email name points tokenLimit tokensUsed");
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json({ ok: true, user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ------------------------------------------------------------------
//  GET /api/admin/points-requests
//  Query: ?status=pending|approved|rejected  (omit for all)
// ------------------------------------------------------------------
router.get("/api/admin/points-requests", adminMiddleware, async (req, res) => {
    try {
        const filter = req.query.status ? { status: req.query.status } : {};
        const requests = await PointsRequest.find(filter)
            .sort({ requestedAt: -1 })
            .lean();
        res.json(requests);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ------------------------------------------------------------------
//  PATCH /api/admin/points-requests/:id  — approve or reject
//  Body: { action: "approve"|"reject", adminNote?: string }
// ------------------------------------------------------------------
router.patch("/api/admin/points-requests/:id", adminMiddleware, async (req, res) => {
    try {
        const { action, adminNote } = req.body;
        if (!["approve", "reject"].includes(action))
            return res.status(400).json({ error: "action must be 'approve' or 'reject'" });

        const request = await PointsRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: "Request not found" });
        if (request.status !== "pending")
            return res.status(400).json({ error: "Request already resolved" });

        request.status     = action === "approve" ? "approved" : "rejected";
        request.adminNote  = adminNote || "";
        request.resolvedAt = new Date();
        await request.save();

        // If approved, credit the user's point balance
        if (action === "approve") {
            await User.findByIdAndUpdate(request.userId, {
                $inc: { points: request.amount }
            });
        }

        res.json({ ok: true, request });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
