const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText } = require('./helpers');

const CATEGORIES = {
    hentai: 'Hentai',
    '2d-animation': '2D Animation',
    '3d-hentai': '3D Hentai',
    jav: 'JAV',
    'jav-cosplay': 'JAV Cosplay'
};

function extractBackgroundImage(style = '') {
    if (!style) return null;
    const match = style.match(/url\((['"]?)(.*?)\1\)/i);
    return match ? match[2] : null;
}

function isValidCategorySlug(slug = '') {
    return Object.prototype.hasOwnProperty.call(CATEGORIES, String(slug || '').toLowerCase());
}

function buildCategoryUrl(slug, page = 1) {
    const safeSlug = String(slug || '').toLowerCase();
    return page > 1
        ? `${BASE_URL}/category/${safeSlug}/page/${page}/`
        : `${BASE_URL}/category/${safeSlug}/`;
}

function extractTotalPages($, fallbackPage = 1) {
    let total = fallbackPage;
    $('.page-numbers, .pagination a, .nav-links a').each((_, element) => {
        const textPage = parseInt(cleanText($(element).text()), 10);
        if (Number.isFinite(textPage)) total = Math.max(total, textPage);

        const href = $(element).attr('href') || '';
        const match = href.match(/\/page\/(\d+)\/?/i);
        if (match) total = Math.max(total, parseInt(match[1], 10) || total);
    });
    return total;
}

function parseCategoryItem($, element) {
    const $item = $(element);
    const url = $item.attr('href');
    const title = cleanText($item.find('.nk-search-info h2, h2').first().text() || $item.attr('title'));
    const poster = extractBackgroundImage($item.find('.nk-search-thumb').first().attr('style'));
    const excerpt = cleanText($item.find('.nk-search-desc').first().text());
    const categoriesText = cleanText($item.find('.nk-search-genres').first().text());
    const categories = categoriesText ? categoriesText.split(/,|\//).map(cleanText).filter(Boolean) : [];

    if (!title || !url) return null;

    return {
        title,
        slug: extractSlugFromUrl(url),
        poster: imageProxy(poster),
        url,
        excerpt,
        categories
    };
}

function parseFallbackItem($, element) {
    const $elem = $(element);
    const $titleLink = $elem.find('h2 a, h3 a, .entry-title a, .title a, a[href]').first();
    const title = cleanText($titleLink.text() || $titleLink.attr('title'));
    const url = $titleLink.attr('href');
    const poster = $elem.find('img').first().attr('src') || $elem.find('img').first().attr('data-src');
    const excerpt = cleanText($elem.find('.excerpt, .entry-summary, .description, p').first().text());

    if (!title || !url) return null;

    return {
        title,
        slug: extractSlugFromUrl(url),
        poster: imageProxy(poster),
        url,
        excerpt,
        categories: []
    };
}

async function scrapeCategory(slug, page = 1) {
    const categorySlug = String(slug || '').trim().toLowerCase();
    if (!isValidCategorySlug(categorySlug)) {
        return {
            status: 'error',
            message: 'Invalid category slug',
            data: null
        };
    }

    try {
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const categoryUrl = buildCategoryUrl(categorySlug, currentPage);
        const $ = await fetchPage(categoryUrl);
        const items = [];

        $('.nk-search-results .nk-search-item').each((_, element) => {
            const item = parseCategoryItem($, element);
            if (item) items.push(item);
        });

        if (items.length === 0) {
            $('.nk-post-card, .post, article, .search-item, .search-result').each((_, element) => {
                const item = parseFallbackItem($, element);
                if (item) items.push(item);
            });
        }

        const title = cleanText($('.nk-section-header h1').first().text() || $('h1').first().text()) || CATEGORIES[categorySlug];
        const totalPages = extractTotalPages($, currentPage);
        const hasNextPage = $('.pagination .next, .nav-links .next, a.next, .page-numbers.next').length > 0 || currentPage < totalPages;

        return {
            status: 'success',
            data: {
                slug: categorySlug,
                title,
                label: CATEGORIES[categorySlug],
                items,
                totalItems: items.length,
                currentPage,
                totalPages,
                hasNextPage,
                hasPrevPage: currentPage > 1
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message,
            data: {
                slug: categorySlug,
                label: CATEGORIES[categorySlug] || categorySlug,
                items: [],
                totalItems: 0
            }
        };
    }
}

module.exports = {
    CATEGORIES,
    isValidCategorySlug,
    scrapeCategory
};
