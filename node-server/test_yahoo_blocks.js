const axios = require('axios');

async function testYahoo() {
    const query = "fastest train in the world";
    const res = await axios.get(`https://search.yahoo.com/search?p=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
        timeout: 8000
    });
    const html = res.data;
    const results = [];

    // Split by compTitle to isolate results. This ensures we don't accidentally mix snippet content across blocks
    const blocks = html.split('class="compTitle');
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];

        // title and url
        const titleMatch = block.match(/<h3[^>]*>.*?<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/);
        if (!titleMatch) continue;

        let url = titleMatch[1];

        // skip image/video blocks
        if (url.includes('images.search.yahoo') || url.includes('video.search.yahoo')) continue;

        // decode yahoo tracking redirect
        if (url.includes('/RU=')) {
            try { url = decodeURIComponent(url.split('/RU=')[1].split('/')[0]); } catch (e) { }
        }

        const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();

        // snippet
        let snippet = "";
        const snipMatch = block.match(/class="compText[^>]*>([\s\S]*?)<\/div>/);
        if (snipMatch) snippet = snipMatch[1].replace(/<[^>]+>/g, '').trim();

        if (title && url && !url.startsWith('/')) {
            results.push({ title, url, snippet });
        }

        if (results.length >= 5) break;
    }

    console.log("Found:", results.length);
    console.log(results.slice(0, 3));
}
testYahoo();
