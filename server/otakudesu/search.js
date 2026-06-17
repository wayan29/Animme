const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug } = require('./helpers');

// Scrape Search
async function scrapeSearch(keyword) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(keyword)}&post_type=anime`;

        console.log('[V1] Searching Otakudesu for:', keyword);

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': BASE_URL,
            },
            timeout: 15000
        });

        const $ = cheerio.load(data);
        const results = [];

        $('.chivsrc li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('h2 a');
            const $img = $el.find('img');

            const title = $link.text().trim();
            if (!title) return;

            const anime = {
                title: title,
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                genres: [],
                status: $el.find('.set:contains("Status")').find('b').text().trim(),
                rating: $el.find('.set:contains("Rating")').find('b').text().trim()
            };

            // Parse genres
            $el.find('.set:contains("Genres")').find('a').each((j, genreEl) => {
                anime.genres.push({
                    name: $(genreEl).text().trim()
                });
            });

            results.push(anime);
        });

        console.log(`[V1] Found ${results.length} results for "${keyword}"`);

        return {
            status: 'success',
            data: results
        };
    } catch (error) {
        console.error('[V1] Error scraping search:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeSearch
};
