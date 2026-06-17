// AnimeIndo Genre Detail Scraper
const {
    BASE_URL,
    fetchPage,
    cleanText,
    extractSlugFromUrl,
    imageProxy,
    toAbsoluteUrl
} = require('./helpers');

function buildGenrePageUrl(slug, page = 1) {
    const normalizedSlug = (slug || '').toString().trim().replace(/^\/+|\/+$/g, '');
    if (!normalizedSlug) {
        throw new Error('Genre slug is required');
    }

    if (page <= 1) {
        return `${BASE_URL}/genres/${normalizedSlug}/`;
    }
    return `${BASE_URL}/genres/${normalizedSlug}/page/${page}/`;
}

function parseGenreItems($) {
    const items = [];
    $('.menu table.otable').each((_, table) => {
        const $table = $(table);
        const $link = $table.find('.videsc a').first();
        const href = $link.attr('href');
        const title = cleanText($link.text());
        if (!href || !title) return;

        const $poster = $table.find('.vithumb img').first();
        const poster = $poster.attr('data-original') || $poster.attr('src');

        const labels = $table.find('.videsc .label').map((i, el) => cleanText($(el).text())).get();
        const description = cleanText($table.find('.videsc p.des').first().text());

        items.push({
            title,
            slug: extractSlugFromUrl(href),
            url: toAbsoluteUrl(href),
            poster: imageProxy(poster),
            poster_original: toAbsoluteUrl(poster),
            labels,
            description
        });
    });
    return items;
}

function parsePagination($, currentPage) {
    const pagination = {
        current_page: currentPage,
        has_next_page: false,
        has_previous_page: currentPage > 1,
        total_pages: null,
        next_page: null,
        previous_page: currentPage > 1 ? currentPage - 1 : null
    };

    const $pager = $('.pag').first();
    if ($pager.length === 0) return pagination;

    $pager.find('a').each((_, link) => {
        const $link = $(link);
        const text = cleanText($link.text());
        const href = $link.attr('href');
        if (!href) return;

        if (text === '»') {
            pagination.has_next_page = true;
            pagination.next_page = extractPageNumber(href);
        } else if (text === '«') {
            pagination.has_previous_page = true;
            pagination.previous_page = extractPageNumber(href);
        } else {
            const pageNum = parseInt(text, 10);
            if (!isNaN(pageNum)) {
                pagination.total_pages = Math.max(pagination.total_pages || 0, pageNum);
            }
        }
    });

    return pagination;
}

function extractPageNumber(url) {
    try {
        const parsed = new URL(url, BASE_URL);
        const match = parsed.pathname.match(/page\/(\d+)/i);
        if (match) {
            return parseInt(match[1], 10);
        }
    } catch (error) {
        return null;
    }
    return null;
}

async function scrapeGenreDetail(slug, page = 1) {
    const targetUrl = buildGenrePageUrl(slug, page);
    const $ = await fetchPage(targetUrl);

    const title = cleanText($('.title').first().text() || slug);
    const items = parseGenreItems($);
    const pagination = parsePagination($, page);

    return {
        status: 'success',
        data: {
            genre: title.replace(/^Genre\s*/i, '') || slug,
            slug,
            current_page: page,
            anime_list: items,
            pagination
        }
    };
}

module.exports = {
    scrapeGenreDetail
};
