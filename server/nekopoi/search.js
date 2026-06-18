const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText } = require('./helpers');

function extractBackgroundImage(style = '') {
    if (!style) return null;
    const match = style.match(/url\((['"]?)(.*?)\1\)/i);
    return match ? match[2] : null;
}

function normalizeSearchQuery(query = '') {
    return String(query || '').trim().replace(/[\x00-\x1F\x7F]/g, '').slice(0, 100);
}

function buildSearchUrl(query, page = 1) {
    const encoded = encodeURIComponent(query).replace(/%20/g, '+');
    return page > 1 ? `${BASE_URL}/search/${encoded}/page/${page}/` : `${BASE_URL}/search/${encoded}/`;
}

function pushResult(results, item) {
    if (!item.title || !item.url) return;
    results.push({
        title: item.title,
        slug: extractSlugFromUrl(item.url),
        poster: imageProxy(item.poster),
        url: item.url,
        excerpt: item.excerpt || '',
        date: item.date || '',
        categories: Array.isArray(item.categories) ? item.categories : []
    });
}

// Search anime/episodes
async function scrapeSearch(query, page = 1) {
    const normalizedQuery = normalizeSearchQuery(query);
    if (!normalizedQuery) {
        return {
            status: 'error',
            message: 'Search query is required',
            data: {
                query: '',
                results: [],
                totalResults: 0
            }
        };
    }

    try {
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const searchUrl = buildSearchUrl(normalizedQuery, currentPage);
        const $ = await fetchPage(searchUrl);

        const results = [];

        // Current ThemeNekopoi search page structure.
        $('.nk-search-results .nk-search-item').each((_, element) => {
            const $item = $(element);
            const url = $item.attr('href');
            const title = cleanText($item.find('.nk-search-info h2, h2').first().text());
            const poster = extractBackgroundImage($item.find('.nk-search-thumb').first().attr('style'));
            const excerpt = cleanText($item.find('.nk-search-desc').first().text());
            const categoriesText = cleanText($item.find('.nk-search-genres').first().text());
            const categories = categoriesText ? categoriesText.split(/,|\//).map(cleanText).filter(Boolean) : [];

            pushResult(results, { title, url, poster, excerpt, categories });
        });

        // Legacy/generic fallback for older search markup.
        if (results.length === 0) {
            $('.post, article, .search-item, .search-result').each((_, element) => {
                const $elem = $(element);
                const $titleLink = $elem.find('h2 a, h3 a, .entry-title a, .title a, a[href]').first();
                const title = cleanText($titleLink.text() || $titleLink.attr('title'));
                const url = $titleLink.attr('href');
                const poster = $elem.find('img').first().attr('src') || $elem.find('img').first().attr('data-src');
                const excerpt = cleanText($elem.find('.excerpt, .entry-summary, .description, p').first().text());
                const date = cleanText($elem.find('.date, .post-date, time').first().text());
                const categories = [];

                $elem.find('.category a, .cat-links a, a[rel="category"]').each((_, catElem) => {
                    const category = cleanText($(catElem).text());
                    if (category) categories.push(category);
                });

                pushResult(results, { title, url, poster, excerpt, date, categories });
            });
        }

        const hasNextPage = $('.pagination .next, .nav-links .next, a.next, .page-numbers.next').length > 0;
        const hasPrevPage = currentPage > 1;

        return {
            status: 'success',
            data: {
                query: normalizedQuery,
                results,
                totalResults: results.length,
                currentPage,
                hasNextPage,
                hasPrevPage
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message,
            data: {
                query: normalizedQuery,
                results: [],
                totalResults: 0
            }
        };
    }
}

module.exports = { scrapeSearch };
