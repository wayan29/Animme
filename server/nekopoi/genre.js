const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText } = require('./helpers');

function extractBackgroundImage(style = '') {
    if (!style) return null;
    const match = style.match(/url\((['"]?)(.*?)\1\)/i);
    return match ? match[2] : null;
}

function isSafeGenreSlug(slug = '') {
    return /^[a-z0-9][a-z0-9_-]{0,80}$/i.test(String(slug || ''));
}

function extractGenreSlug(url = '') {
    const match = String(url || '').match(/\/genres\/([^/]+)/i);
    return match ? decodeURIComponent(match[1]) : extractSlugFromUrl(url);
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

function parseBrowseItem($, element) {
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

async function scrapeGenreList() {
    try {
        const $ = await fetchPage(`${BASE_URL}/genre-list/`);
        const genres = [];
        const seen = new Set();

        $('.nk-genre-list a[href*="/genres/"], a[href*="/genres/"]').each((_, element) => {
            const $link = $(element);
            const url = $link.attr('href');
            const slug = extractGenreSlug(url);
            const name = cleanText($link.text()) || slug;
            if (!slug || !name || seen.has(slug)) return;
            seen.add(slug);
            genres.push({ name, slug, url });
        });

        return {
            status: 'success',
            data: {
                totalGenres: genres.length,
                genres
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message,
            data: null
        };
    }
}

async function scrapeGenre(slug, page = 1) {
    const genreSlug = String(slug || '').trim().toLowerCase();
    if (!isSafeGenreSlug(genreSlug)) {
        return {
            status: 'error',
            message: 'Invalid genre slug',
            data: null
        };
    }

    try {
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const url = currentPage > 1
            ? `${BASE_URL}/genres/${genreSlug}/page/${currentPage}/`
            : `${BASE_URL}/genres/${genreSlug}/`;
        const $ = await fetchPage(url);
        const items = [];

        $('.nk-search-results .nk-search-item').each((_, element) => {
            const item = parseBrowseItem($, element);
            if (item) items.push(item);
        });

        if (items.length === 0) {
            $('.nk-post-card, .post, article, .search-item, .search-result').each((_, element) => {
                const item = parseBrowseItem($, element);
                if (item) items.push(item);
            });
        }

        const title = cleanText($('.nk-section-header h1').first().text() || $('h1').first().text()) || genreSlug;
        const totalPages = extractTotalPages($, currentPage);
        const hasNextPage = $('.pagination .next, .nav-links .next, a.next, .page-numbers.next').length > 0 || currentPage < totalPages;

        return {
            status: 'success',
            data: {
                slug: genreSlug,
                title,
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
            data: null
        };
    }
}

module.exports = {
    isSafeGenreSlug,
    scrapeGenreList,
    scrapeGenre
};
