// Anoboy Search Scraper
const { BASE_URL, imageProxy, fetchPage, extractSlugFromUrl, cleanText } = require('./helpers');

/**
 * Search anime by keyword
 */
async function scrapeSearch(keyword) {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(keyword)}`;
        console.log(`[Anoboy] Searching for: ${keyword}`);

        const $ = await fetchPage(url);
        const results = [];

        $('.listupd article.bs, .bs').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const $img = $el.find('img').first();
            const $type = $el.find('.type').first();
            const $score = $el.find('.score, .rating').first();

            // Try to get title from h2 first (most accurate), then from link title attribute
            let title = cleanText($el.find('h2').first().text());
            if (!title) {
                title = cleanText($link.attr('title') || '');
            }

            const url = $link.attr('href') || '';
            const image = $img.attr('src') || $img.attr('data-src') || '';
            const type = cleanText($type.text());
            const score = cleanText($score.text());

            if (title && url) {
                results.push({
                    title,
                    slug: extractSlugFromUrl(url),
                    url,
                    poster: imageProxy(image),
                    type,
                    score
                });
            }
        });

        console.log(`[Anoboy] Found ${results.length} search results`);
        return {
            status: 'success',
            data: {
                keyword,
                results,
                total: results.length
            }
        };
    } catch (error) {
        console.error('[Anoboy] Error searching:', error.message);
        return {
            status: 'error',
            message: error.message,
            data: {
                keyword,
                results: [],
                total: 0
            }
        };
    }
}

module.exports = {
    scrapeSearch
};
