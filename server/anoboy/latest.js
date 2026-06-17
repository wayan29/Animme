// Anoboy Latest Release Scraper
const { BASE_URL, imageProxy, fetchPage, extractSlugFromUrl, cleanText } = require('./helpers');

/**
 * Scrape latest release anime with pagination
 */
async function scrapeLatestRelease(page = 1) {
    try {
        const url = page === 1
            ? `${BASE_URL}/anime/?status=&type=&order=update`
            : `${BASE_URL}/anime/?page=${page}&status=&type=&order=update`;

        console.log(`[Anoboy] Scraping latest release page ${page}: ${url}`);

        const $ = await fetchPage(url);
        const animeList = [];

        // Extract anime from list
        $('.listupd .bs, .listupd article.bs').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const $img = $el.find('img').first();
            const $type = $el.find('.type').first();
            const $score = $el.find('.score, .rating').first();

            // Get title from h2 (most accurate)
            let title = cleanText($el.find('h2').first().text());
            if (!title) {
                title = cleanText($link.attr('title') || '');
            }

            const url = $link.attr('href') || '';
            const image = $img.attr('src') || $img.attr('data-src') || '';
            const type = cleanText($type.text());
            const score = cleanText($score.text());

            if (title && url) {
                animeList.push({
                    title,
                    slug: extractSlugFromUrl(url),
                    url,
                    poster: imageProxy(image),
                    type,
                    score
                });
            }
        });

        // Check pagination
        const $nextPage = $('.hpage a.r').first();
        const hasNextPage = $nextPage.length > 0;
        const nextPage = hasNextPage ? page + 1 : null;

        console.log(`[Anoboy] Found ${animeList.length} anime on page ${page}, has next: ${hasNextPage}`);

        return {
            status: 'success',
            data: {
                current_page: page,
                anime_list: animeList,
                total: animeList.length,
                has_next_page: hasNextPage,
                next_page: nextPage
            }
        };
    } catch (error) {
        console.error('[Anoboy] Error scraping latest release:', error.message);
        return {
            status: 'error',
            message: error.message,
            data: {
                current_page: page,
                anime_list: [],
                total: 0,
                has_next_page: false,
                next_page: null
            }
        };
    }
}

module.exports = {
    scrapeLatestRelease
};
