// AnimeIndo Genre List Scraper
const {
    BASE_URL,
    fetchPage,
    cleanText,
    extractSlugFromUrl,
    toAbsoluteUrl
} = require('./helpers');

/**
 * Scrape genre list page
 * @returns {Promise<object>}
 */
async function scrapeGenreList() {
    const $ = await fetchPage(`${BASE_URL}/list-genre/`);
    const genres = [];

    $('.list-genre a').each((_, el) => {
        const $link = $(el);
        const name = cleanText($link.text());
        const href = $link.attr('href');
        if (!name || !href) return;

        genres.push({
            name,
            slug: extractSlugFromUrl(href),
            url: toAbsoluteUrl(href)
        });
    });

    return {
        status: 'success',
        data: {
            total: genres.length,
            genres
        }
    };
}

module.exports = {
    scrapeGenreList
};
