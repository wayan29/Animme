// AnimeIndo Home Page Scraper
const {
    BASE_URL,
    fetchPage,
    cleanText,
    extractSlugFromUrl,
    imageProxy,
    toAbsoluteUrl
} = require('./helpers');

/**
 * Parse "Update Terbaru" section from document
 * @param {CheerioStatic} $
 * @returns {Array<object>}
 */
function parseUpdateTerbaru($) {
    const results = [];

    $('.ngiri .menu a').each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        const $item = $link.find('.list-anime').first();
        const $img = $item.find('img').first();

        let imageUrl = $img.attr('data-original') || $img.attr('data-src') || $img.attr('src') || '';
        if (imageUrl && imageUrl.includes('/loading.gif')) {
            imageUrl = null;
        }

        const title = cleanText($item.find('p').first().text() || $img.attr('alt'));
        const episode = cleanText($item.find('.eps').first().text());
        const url = toAbsoluteUrl(href);
        const slug = extractSlugFromUrl(href);

        if (!title || !url) return;

        results.push({
            title,
            slug,
            url,
            poster: imageProxy(imageUrl),
            episode
        });
    });

    return results;
}

/**
 * Parse "Popular" sidebar section from document
 * @param {CheerioStatic} $
 * @returns {Array<object>}
 */
function parsePopular($) {
    const results = [];

    $('.nganan .menu table.ztable').each((_, table) => {
        const $table = $(table);
        const $descCell = $table.find('.zvidesc').first();
        const $titleLink = $descCell.find('a').first();
        const $thumbLink = $table.find('.zvithumb a').first();
        const $img = $thumbLink.find('img').first();

        const href = $titleLink.attr('href') || $thumbLink.attr('href');
        const title = cleanText($titleLink.text() || $img.attr('alt'));
        if (!title) return;

        const imageUrl = $img.attr('data-original') || $img.attr('data-src') || $img.attr('src');

        // Description text appears after <br> inside .zvidesc
        const rawDescription = [];
        $descCell.contents().each((_, node) => {
            if (node.type === 'text') {
                const text = cleanText($(node).text());
                if (text) rawDescription.push(text);
            }
        });

        const description = rawDescription.join(' ');

        results.push({
            title,
            slug: extractSlugFromUrl(href),
            url: toAbsoluteUrl(href),
            poster: imageProxy(imageUrl),
            description
        });
    });

    return results;
}

/**
 * Parse pagination element on homepage
 * @param {CheerioStatic} $
 * @param {number} currentPage
 * @returns {object}
 */
function parsePagination($, currentPage) {
    const pagination = {
        current_page: currentPage,
        has_next_page: false,
        has_previous_page: currentPage > 1,
        next_page: null,
        previous_page: currentPage > 1 ? currentPage - 1 : null
    };

    const $pager = $('.pag').first();
    if ($pager.length === 0) {
        return pagination;
    }

    $pager.find('a').each((_, link) => {
        const $link = $(link);
        const text = cleanText($link.text());
        const href = $link.attr('href');

        if (text === '»') {
            pagination.has_next_page = true;
            pagination.next_page = href ? toAbsoluteUrl(href) : null;
        } else if (text === '«') {
            pagination.has_previous_page = true;
            pagination.previous_page = href ? toAbsoluteUrl(href) : null;
        }
    });

    return pagination;
}

/**
 * Scrape Update Terbaru section (with optional pagination)
 * @param {number} page
 * @returns {Promise<object>}
 */
async function scrapeUpdateTerbaru(page = 1) {
    const targetUrl = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
    const $ = await fetchPage(targetUrl);
    const updates = parseUpdateTerbaru($);
    const pagination = parsePagination($, page);

    return {
        status: 'success',
        data: {
            current_page: page,
            updates,
            pagination
        }
    };
}

/**
 * Scrape Popular section (available only on page 1)
 * @returns {Promise<object>}
 */
async function scrapePopular() {
    const $ = await fetchPage(BASE_URL);
    const popular = parsePopular($);

    return {
        status: 'success',
        data: {
            popular,
            total: popular.length
        }
    };
}

/**
 * Scrape combined homepage data
 * @param {number} page
 * @returns {Promise<object>}
 */
async function scrapeHomepage(page = 1) {
    const targetUrl = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
    const $ = await fetchPage(targetUrl);

    const updates = parseUpdateTerbaru($);
    const pagination = parsePagination($, page);
    const popular = page === 1 ? parsePopular($) : [];

    return {
        status: 'success',
        data: {
            update_terbaru: updates,
            popular,
            pagination
        }
    };
}

module.exports = {
    scrapeUpdateTerbaru,
    scrapePopular,
    scrapeHomepage
};
