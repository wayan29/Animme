// Anoboy A-Z List Scraper
const { BASE_URL, imageProxy, fetchPage, extractSlugFromUrl, cleanText } = require('./helpers');

/**
 * Scrape anime list by alphabet filter
 */
async function scrapeAZList(letter = 'A') {
    try {
        // Validate letter parameter
        const validLetters = ['#', '0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

        if (!validLetters.includes(letter.toUpperCase())) {
            letter = 'A'; // Default to A
        }

        // Map special characters
        const showParam = letter === '#' ? '.' : letter;
        const url = letter === 'A' && showParam === 'A'
            ? `${BASE_URL}/az-list/`
            : `${BASE_URL}/az-list/?show=${showParam}`;

        console.log(`[Anoboy] Scraping A-Z list for letter: ${letter} (${url})`);

        const $ = await fetchPage(url);
        const animeList = [];

        // Extract anime from list
        $('.listupd .bs, .listupd article.bs').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const $img = $el.find('img').first();
            const $title = $el.find('.tt, h2, h3, .title').first();
            const $type = $el.find('.type').first();
            const $score = $el.find('.score, .rating').first();

            const title = cleanText($title.text() || $link.attr('title') || '');
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

        // Get alphabet navigation
        const alphabetNav = [];
        $('.azlistfilm ul li a').each((i, el) => {
            const $el = $(el);
            const text = cleanText($el.text());
            const href = $el.attr('href') || '';
            const match = href.match(/show=([^&]+)/);
            const letterValue = match ? match[1] : (text === '#' ? '.' : text);

            if (text) {
                alphabetNav.push({
                    letter: text,
                    value: letterValue,
                    active: letterValue === showParam || (text === 'A' && !showParam)
                });
            }
        });

        console.log(`[Anoboy] Found ${animeList.length} anime for letter ${letter}`);

        return {
            status: 'success',
            data: {
                current_letter: letter,
                anime_list: animeList,
                alphabet_nav: alphabetNav,
                total: animeList.length
            }
        };
    } catch (error) {
        console.error('[Anoboy] Error scraping A-Z list:', error.message);
        return {
            status: 'error',
            message: error.message,
            data: {
                current_letter: letter,
                anime_list: [],
                alphabet_nav: [],
                total: 0
            }
        };
    }
}

module.exports = {
    scrapeAZList
};
