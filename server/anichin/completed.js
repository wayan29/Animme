const cheerio = require('cheerio');
const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl } = require('./helpers');

function buildCompletedUrl(page = 1) {
    if (page && page > 1) {
        return `${BASE_URL}/completed/page/${page}/`;
    }
    return `${BASE_URL}/completed/`;
}

function normalizeText(value) {
    return value ? value.replace(/\s+/g, ' ').trim() : '';
}

function extractPageNumber(url) {
    if (!url) return null;
    const match = url.match(/page\/(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
}

async function scrapeCompleted(page = 1) {
    try {
        const targetUrl = buildCompletedUrl(page);
        console.log(`[Anichin] Scraping completed list: ${targetUrl}`);

        const html = await fetchPage(targetUrl);
        const $ = cheerio.load(html);
        const items = [];

        const articles = $('.listupd.cp article.bs');
        for (const element of articles.toArray()) {
            const $article = $(element);
            const $link = $article.find('a').first();
            const url = $link.attr('href');
            if (!url) continue;

            const rawTitle = $link.attr('title') || $article.find('.tt').text() || '';
            const title = normalizeText(rawTitle);
            const slug = extractSlugFromUrl(url);
            const posterSrc = $link.find('img').attr('src') || '';
            const status = normalizeText($link.find('.status').text());
            const type = normalizeText($link.find('.typez').text());
            const episodeText = normalizeText($link.find('.epx').text());
            const subtitleText = normalizeText($link.find('.sb').text());
            const relId = normalizeText($link.attr('rel'));

            const cachedPoster = posterSrc ? await imageProxy.processPosterUrl(posterSrc) : posterSrc;

            items.push({
                title,
                slug,
                url,
                poster: cachedPoster,
                status,
                type,
                episode_text: episodeText || status,
                subtitle: subtitleText,
                rel_id: relId || null
            });
        }

        const pagination = $('.pagination');
        const currentPage = parseInt(pagination.find('.page-numbers.current').text(), 10) || page || 1;

        let totalPages = currentPage;
        pagination.find('a.page-numbers').each((_, el) => {
            const num = parseInt($(el).text(), 10);
            if (!isNaN(num) && num > totalPages) {
                totalPages = num;
            }
        });

        const nextLink = pagination.find('a.next.page-numbers').attr('href') || null;
        const prevLink = pagination.find('a.prev.page-numbers').attr('href') || null;

        const response = {
            page: currentPage,
            total_pages: totalPages,
            has_next: Boolean(nextLink),
            has_prev: currentPage > 1 || Boolean(prevLink),
            next_page: extractPageNumber(nextLink),
            prev_page: extractPageNumber(prevLink),
            per_page: items.length,
            list: items,
            source_url: targetUrl
        };

        console.log(`[Anichin] Completed list scraped: ${items.length} items (page ${currentPage}/${totalPages})`);
        return response;
    } catch (error) {
        console.error('[Anichin] Error scraping completed list:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeCompleted
};
