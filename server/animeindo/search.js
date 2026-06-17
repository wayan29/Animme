// AnimeIndo Search Scraper
const {
    BASE_URL,
    fetchPage,
    cleanText,
    extractSlugFromUrl,
    imageProxy,
    toAbsoluteUrl
} = require('./helpers');

/**
 * Build search URL for given keyword
 * @param {string} keyword
 * @returns {string}
 */
function buildSearchUrl(keyword) {
    const query = keyword || '';
    return `${BASE_URL}/search.php?q=${encodeURIComponent(query)}`;
}

/**
 * Scrape search results from AnimeIndo
 * @param {string} keyword
 * @returns {Promise<object>}
 */
async function scrapeSearch(keyword = '') {
    const trimmedKeyword = cleanText(keyword);
    if (!trimmedKeyword) {
        return {
            status: 'error',
            message: 'Keyword pencarian wajib diisi',
            data: {
                keyword: '',
                total: 0,
                results: []
            }
        };
    }

    const $ = await fetchPage(buildSearchUrl(trimmedKeyword));
    const results = [];

    $('.menu table').each((_, table) => {
        const $table = $(table);
        const $link = $table.find('.videsc a').first();
        const href = $link.attr('href');
        const title = cleanText($link.text());
        if (!href || !title) return;

        const $poster = $table.find('.vithumb img').first();
        const poster = $poster.attr('data-original') || $poster.attr('src');

        const labels = $table.find('.videsc .label').map((i, el) => cleanText($(el).text())).get();
        const description = cleanText($table.find('.videsc p.des').first().text());

        results.push({
            title,
            slug: extractSlugFromUrl(href),
            url: toAbsoluteUrl(href),
            poster: imageProxy(poster),
            poster_original: toAbsoluteUrl(poster),
            labels,
            description
        });
    });

    const headline = cleanText($('.title').first().text());

    return {
        status: 'success',
        data: {
            keyword: trimmedKeyword,
            headline,
            total: results.length,
            results
        }
    };
}

module.exports = {
    scrapeSearch
};
