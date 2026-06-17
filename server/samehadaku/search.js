const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug, fetchDocument } = require('./helpers');

// Scrape Search
async function scrapeSearch(keyword) {
    try {
        const url = `${BASE_URL}/search/${encodeURIComponent(keyword)}/`;

        console.log('[V2] Searching Samehadaku for:', keyword);

        const $ = await fetchDocument(url);
        const results = [];

        $('.post-show ul li, .relat article.animpost').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.dtla h2 a, .animposx a').first();
            const $img = $el.find('.thumb img, .content-thumb img').first();

            const title = $el.find('.data .title h2, .dtla h2 a').first().text().trim() || $link.attr('title') || $link.text().trim();
            if (!title) return;

            const anime = {
                title: title,
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                genres: [],
                status: $el.find('.data .type').first().text().trim(),
                rating: $el.find('.score').first().text().replace(/★/g, '').trim()
            };

            $el.find('.genres a, .mta a').each((_, genreEl) => {
                const genre = $(genreEl).text().trim();
                if (genre) anime.genres.push(genre);
            });

            results.push(anime);
        });

        console.log(`[V2] Found ${results.length} results for "${keyword}"`);

        return {
            status: 'success',
            data: results
        };
    } catch (error) {
        console.error('[V2] Error scraping samehadaku search:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeSearch
};
