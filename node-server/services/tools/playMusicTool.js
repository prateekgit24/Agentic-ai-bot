const axios = require("axios");

const YT_API_KEY = process.env.YOUTUBE_API_KEY;

// ─── In-memory music cache ────────────────────────────────────────────────────
// Key: normalised query string  →  Value: { videoId, title, channel, thumbnail }
// Pre-seeded with popular searches so they NEVER hit the API.
const MUSIC_CACHE = new Map([
    // Bollywood
    ["tum hi ho", { videoId: "Umqb9KQ8no4", title: "Tum Hi Ho", channel: "T-Series" }],
    ["kesariya", { videoId: "BddP6PYo2gs", title: "Kesariya", channel: "Sony Music India" }],
    ["raataan lambiyan", { videoId: "R3IKDMmMFAM", title: "Raataan Lambiyan", channel: "Sony Music India" }],
    ["perfect ed sheeran", { videoId: "2Vv-BfVoq4g", title: "Perfect", channel: "Ed Sheeran" }],
    ["shape of you", { videoId: "JGwWNGJdvx8", title: "Shape of You", channel: "Ed Sheeran" }],
    ["blinding lights", { videoId: "4NRXx6U8ekI", title: "Blinding Lights", channel: "The Weeknd" }],
    ["stay kid laroi", { videoId: "kTJczUoc26U", title: "STAY", channel: "The Kid LAROI & Justin Bieber" }],
    ["levitating dua lipa", { videoId: "TUVcZfQe-Kw", title: "Levitating", channel: "Dua Lipa" }],
    ["believer imagine dragons", { videoId: "7wtfhZwyrcc", title: "Believer", channel: "Imagine Dragons" }],
    ["thunder imagine dragons", { videoId: "fKopy74weus", title: "Thunder", channel: "Imagine Dragons" }],
    ["rockstar dabababy", { videoId: "UceaB4D0jpo", title: "ROCKSTAR", channel: "DaBaby" }],
    ["sunflower post malone", { videoId: "ApXoWvfEYVU", title: "Sunflower", channel: "Post Malone" }],
    ["dynamite bts", { videoId: "gdZLi9oWNZg", title: "Dynamite", channel: "HYBE LABELS" }],
    ["butter bts", { videoId: "WMweEpGlu_U", title: "Butter", channel: "HYBE LABELS" }],
    ["photograph ed sheeran", { videoId: "nSDgHBxUbVQ", title: "Photograph", channel: "Ed Sheeran" }],
    ["senorita", { videoId: "Pkh8UtuejGw", title: "Señorita", channel: "Shawn Mendes" }],
    ["havana camila cabello", { videoId: "HCjNJDNzw8Y", title: "Havana", channel: "Camila Cabello" }],
    ["apna bana le", { videoId: "lKD-kbILl-E", title: "Apna Bana Le", channel: "T-Series" }],
    ["jai ho", { videoId: "UKDrJJCERzA", title: "Jai Ho", channel: "T-Series" }],
    ["mile sur mera tumhara", { videoId: "z6BToBQ3rGU", title: "Mile Sur Mera Tumhara", channel: "Doordarshan" }],
    ["gerua", { videoId: "AEIVhBS6baE", title: "Gerua", channel: "Sony Music India" }],
    ["tujhe kitna chahne lage", { videoId: "ADwPe7aRWpk", title: "Tujhe Kitna Chahne Lage", channel: "T-Series" }],
    ["channa mereya", { videoId: "284Ov7ysmfA", title: "Channa Mereya", channel: "Sony Music India" }],
    ["kal ho na ho", { videoId: "VtxkNWErpC8", title: "Kal Ho Na Ho", channel: "Sony Music India" }],
    ["don't start now dua lipa", { videoId: "oygrmJFKYZY", title: "Don't Start Now", channel: "Dua Lipa" }],
    ["bad guy billie eilish", { videoId: "DyDfgMOUjCI", title: "bad guy", channel: "Billie Eilish" }],
    ["something just like this", { videoId: "FM7MFYoylVs", title: "Something Just Like This", channel: "The Chainsmokers" }],
    ["closer chainsmokers", { videoId: "PT2_F-1esPk", title: "Closer", channel: "The Chainsmokers" }],
    ["roar katy perry", { videoId: "CevxZvSJLk8", title: "Roar", channel: "Katy Perry" }],
    ["baby justin bieber", { videoId: "kffacxfA7G4", title: "Baby", channel: "Justin Bieber" }],
]);

/** Normalise a search query to maximise cache hits */
function normalise(q) {
    return q.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

// ─────────────────────────────────────────────────────────────────────────────

async function playMusic(parameters = {}) {

    console.log("=== playMusic STARTED ===");
    const { query } = parameters;

    if (!query) {
        return { type: "tool_result", tool: "play_music", ui: "error-card", data: { message: "Query required." } };
    }

    const key = normalise(query);

    // ── Cache hit ──────────────────────────────────────────────────────────────
    if (MUSIC_CACHE.has(key)) {
        const cached = MUSIC_CACHE.get(key);
        console.log("✅ Music cache hit for:", key);
        return {
            type: "tool_result",
            tool: "play_music",
            ui: "music-card",
            data: {
                title: cached.title,
                channel: cached.channel,
                videoId: cached.videoId,
                thumbnail: cached.thumbnail || `https://img.youtube.com/vi/${cached.videoId}/hqdefault.jpg`,
                fromCache: true
            }
        };
    }

    // ── API call ───────────────────────────────────────────────────────────────
    try {
        console.log("➡ Cache miss — calling YouTube API for:", query);

        const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
            params: { part: "snippet", q: query, key: YT_API_KEY, type: "video", maxResults: 1 }
        });

        const items = response.data.items;
        if (!items || items.length === 0) throw new Error("No video found");

        const video = items[0];
        if (!video.id?.videoId) throw new Error("Invalid video response");

        const result = {
            title: video.snippet?.title || "Unknown",
            channel: video.snippet?.channelTitle || "Unknown",
            videoId: video.id.videoId,
            thumbnail: video.snippet?.thumbnails?.high?.url || ""
        };

        // Cache runtime result
        MUSIC_CACHE.set(key, result);
        console.log("✅ Cached new result for:", key);

        return { type: "tool_result", tool: "play_music", ui: "music-card", data: result };

    } catch (err) {
        console.error("🔥 Music tool error:", err.message);
        return { type: "tool_result", tool: "play_music", ui: "error-card", data: { message: "Unable to fetch music." } };
    }
}

module.exports = { playMusic };





//     try {
//         const { query } = parameters;

//         if (!query) {
//             throw new Error("Query required");
//         }

//         const response = await axios.get(
//             "https://www.googleapis.com/youtube/v3/search",
//             {
//                 params: {
//                     part: "snippet",
//                     q: query,
//                     key: YT_API_KEY,
//                     type: "video",
//                     maxResults: 1
//                 }
//             }
//         );

//         const items = response.data.items;

// if (!items || items.length === 0) {
//     throw new Error("No video found");
// }

// const video = items[0];

// if (!video.id?.videoId) {
//     throw new Error("Invalid video response");
// }

// console.log("Music tool returning:", {
//     title: video.snippet?.title,
//     channel: video.snippet?.channelTitle,
//     videoId: video.id?.videoId
// });
//         return {
//     type: "tool_result",
//     tool: "play_music",
//     ui: "music-card",
//     data: {
//         title: video.snippet?.title || "Unknown",
//         channel: video.snippet?.channelTitle || "Unknown",
//         videoId: video.id.videoId,
//         thumbnail: video.snippet?.thumbnails?.high?.url || ""
//     }
// };
//     } catch (err) {
//         return {
//             type: "tool_result",
//             tool: "play_music",
//             ui: "error-card",
//             data: {
//                 message: "Unable to fetch music."
//             }
//         };
//     }
// }

// module.exports = { playMusic };



//const axios = require("axios");

//const YT_API_KEY = process.env.YOUTUBE_API_KEY;

async function playMusic(parameters = {}) {

    console.log("=== playMusic STARTED ===");
    console.log("Parameters received:", parameters);

    try {
        const { query } = parameters;

        if (!query) {
            console.log("❌ Query missing");
            throw new Error("Query required");
        }

        console.log("Query:", query);
        console.log("API Key present:", !!YT_API_KEY);

        console.log("➡ Sending request to YouTube API...");

        const response = await axios.get(
            "https://www.googleapis.com/youtube/v3/search",
            {
                params: {
                    part: "snippet",
                    q: query,
                    key: YT_API_KEY,
                    type: "video",
                    maxResults: 1
                }
            }
        );

        console.log("✅ YouTube API responded");
        console.log("Raw response:", response.data);

        const items = response.data.items;

        if (!items || items.length === 0) {
            console.log("❌ No items returned");
            throw new Error("No video found");
        }

        const video = items[0];

        console.log("First video object:", video);

        if (!video.id?.videoId) {
            console.log("❌ videoId missing");
            throw new Error("Invalid video response");
        }

        console.log("✅ Video ID found:", video.id.videoId);

        return {
            type: "tool_result",
            tool: "play_music",
            ui: "music-card",
            data: {
                title: video.snippet?.title || "Unknown",
                channel: video.snippet?.channelTitle || "Unknown",
                videoId: video.id.videoId,
                thumbnail: video.snippet?.thumbnails?.high?.url || ""
            }
        };

    } catch (err) {
        console.error("🔥 Music tool error:", err.message);

        return {
            type: "tool_result",
            tool: "play_music",
            ui: "error-card",
            data: {
                message: "Unable to fetch music."
            }
        };
    }
}

module.exports = { playMusic };