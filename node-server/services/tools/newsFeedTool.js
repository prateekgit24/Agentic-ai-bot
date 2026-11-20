// newsFeedTool.js — Fetches news from multiple RSS feeds (no API key needed)
const axios = require("axios");

// Public RSS feeds — no API key required
const FEEDS = {
    world:       { label: "World",       url: "https://feeds.bbci.co.uk/news/world/rss.xml",    source: "BBC News" },
    technology:  { label: "Technology",  url: "https://feeds.bbci.co.uk/news/technology/rss.xml",source: "BBC Tech" },
    science:     { label: "Science",     url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", source: "BBC Science" },
    business:    { label: "Business",    url: "https://feeds.bbci.co.uk/news/business/rss.xml",  source: "BBC Business" },
    health:      { label: "Health",      url: "https://feeds.bbci.co.uk/news/health/rss.xml",    source: "BBC Health" },
    sports:      { label: "Sports",      url: "https://feeds.bbci.co.uk/sport/rss.xml",          source: "BBC Sport" },
    top:         { label: "Top Stories", url: "https://feeds.bbci.co.uk/news/rss.xml",           source: "BBC News" },
    hacker_news: { label: "Hacker News", url: "https://hnrss.org/frontpage",                    source: "Hacker News" }
};

// Lightweight XML parser for RSS <item> blocks
function parseRSS(xml) {
    const articles = [];

    // Pull out item blocks
    const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemPattern.exec(xml)) !== null) {
        const block = match[1];

        const get = (tag) => {
            const m = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i").exec(block);
            if (!m) return "";
            return (m[1] || m[2] || "").trim();
        };

        const title       = get("title");
        const description = get("description").replace(/<[^>]+>/g, "").trim().slice(0, 220);
        const link        = get("link") || (/<link>([^<]+)/.exec(block) || [])[1] || "";
        const pubDate     = get("pubDate");
        const image       = (/<media:thumbnail[^>]+url="([^"]+)"/.exec(block) || [])[1] || "";

        if (title && link) {
            articles.push({ title, description, link: link.trim(), pubDate, image });
        }
    }

    return articles;
}

async function getNewsFeed(parameters = {}) {
    const { category = "top", count = 10 } = parameters;
    const maxCount = Math.min(parseInt(count) || 10, 20);

    const feed = FEEDS[category] || FEEDS["top"];

    try {
        const res = await axios.get(feed.url, {
            timeout: 10000,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; AnyaAIBot/1.0)",
                "Accept": "application/rss+xml, application/xml, text/xml, */*"
            },
            responseType: "text"
        });

        const articles = parseRSS(res.data).slice(0, maxCount);

        if (articles.length === 0) {
            return {
                type: "tool_result",
                tool: "get_news",
                ui: "news-card",
                data: {
                    category,
                    categoryLabel: feed.label,
                    source: feed.source,
                    articles: [],
                    error: "No articles found in feed."
                }
            };
        }

        return {
            type: "tool_result",
            tool: "get_news",
            ui: "news-card",
            data: {
                category,
                categoryLabel: feed.label,
                source: feed.source,
                fetchedAt: new Date().toISOString(),
                articles
            }
        };

    } catch (err) {
        console.error("News feed error:", err.message);

        return {
            type: "tool_result",
            tool: "get_news",
            ui: "error-card",
            data: { message: `Could not fetch news: ${err.message}` }
        };
    }
}

// Expose feed list for frontend category picker
function getFeedList() {
    return Object.entries(FEEDS).map(([key, val]) => ({
        key,
        label: val.label,
        source: val.source
    }));
}

module.exports = { getNewsFeed, getFeedList };
