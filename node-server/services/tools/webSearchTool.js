// webSearchTool.js — DuckDuckGo search with HTML fallback
const axios = require("axios");

// Strip HTML tags from snippets
function stripHtml(str) {
    return str ? str.replace(/<[^>]*>/g, "") : "";
}

async function webSearch(parameters = {}) {
    const query = (parameters.query || "").trim();
    if (!query) {
        return {
            type: "tool_result",
            tool: "web_search",
            ui: "error-card",
            data: { message: "No search query provided." }
        };
    }

    try {
        // DuckDuckGo Instant Answer API (free, no key)
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const ddgRes = await axios.get(ddgUrl, { timeout: 8000 });
        const ddgData = ddgRes.data;

        const results = [];

        // Abstract (best single answer)
        if (ddgData.AbstractText) {
            results.push({
                title: ddgData.Heading || query,
                snippet: ddgData.AbstractText.slice(0, 300),
                url: ddgData.AbstractURL || ddgData.AbstractSource || ""
            });
        }

        // Related topics
        if (ddgData.RelatedTopics && results.length < 5) {
            for (const topic of ddgData.RelatedTopics) {
                if (results.length >= 5) break;
                if (topic.Text && topic.FirstURL) {
                    results.push({
                        title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 60),
                        snippet: stripHtml(topic.Text).slice(0, 200),
                        url: topic.FirstURL
                    });
                }
                // Handle sub-topics
                if (topic.Topics) {
                    for (const sub of topic.Topics) {
                        if (results.length >= 5) break;
                        if (sub.Text && sub.FirstURL) {
                            results.push({
                                title: sub.Text.slice(0, 60),
                                snippet: stripHtml(sub.Text).slice(0, 200),
                                url: sub.FirstURL
                            });
                        }
                    }
                }
            }
        }

        // If DDG Instant API returns nothing useful, scrape Yahoo HTML results
        if (results.length === 0) {
            try {
                const htmlRes = await axios.get(`https://search.yahoo.com/search?p=${encodeURIComponent(query)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                    timeout: 8000
                });
                const html = htmlRes.data;

                const itemRegex = /<div class="compTitle options-toggle"><h3 class="title"><a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a><\/h3>[\s\S]*?<div class="compText aAbs"[^>]*>([\s\S]*?)<\/div>/g;
                let match;
                while ((match = itemRegex.exec(html)) !== null && results.length < 5) {
                    let urlStr = match[1];
                    if (urlStr.includes('/RU=')) {
                        try {
                            urlStr = decodeURIComponent(urlStr.split('/RU=')[1].split('/')[0]);
                        } catch (e) { }
                    }
                    results.push({
                        url: urlStr,
                        title: match[2].replace(/<[^>]+>/g, '').trim(),
                        snippet: match[3].replace(/<[^>]+>/g, '').trim()
                    });
                }

                if (results.length === 0) {
                    const aRegex = /<h3 class="title[^"]*"><a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g;
                    while ((match = aRegex.exec(html)) !== null && results.length < 5) {
                        let urlStr = match[1];
                        if (urlStr.includes('/RU=')) {
                            try { urlStr = decodeURIComponent(urlStr.split('/RU=')[1].split('/RK=')[0]); } catch (e) { }
                        }
                        results.push({
                            url: urlStr,
                            title: match[2].replace(/<[^>]+>/g, '').trim(),
                            snippet: ""
                        });
                    }
                }
            } catch (err) {
                console.error("Yahoo scrape fallback failed:", err.message);
            }
        }


        // Final safe return check
        if (results.length === 0) {
            return {
                type: "tool_result",
                tool: "web_search",
                ui: "search-card",
                data: {
                    query,
                    results: [],
                    fallback: `https://www.google.com/search?q=${encodeURIComponent(query)}`
                }
            };
        }

        return {
            type: "tool_result",
            tool: "web_search",
            ui: "search-card",
            data: { query, results }
        };

    } catch (err) {
        console.error("Web search error:", err.message);
        return {
            type: "tool_result",
            tool: "web_search",
            ui: "search-card",
            data: {
                query,
                results: [],
                fallback: `https://www.google.com/search?q=${encodeURIComponent(query)}`
            }
        };
    }
}

module.exports = { webSearch };
