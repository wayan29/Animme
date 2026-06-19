const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText, parseEpisodeNumber } = require('./helpers');

function extractBackgroundImage(style = '') {
    if (!style) return null;
    const match = style.match(/url\((['"]?)(.*?)\1\)/i);
    return match ? match[2] : null;
}

function pushEpisode(episodes, { title, url, poster, date = '', series = '' }) {
    if (!title || !url) return;
    episodes.push({
        title,
        slug: extractSlugFromUrl(url),
        poster: imageProxy(poster),
        url,
        date,
        series,
        episode: parseEpisodeNumber(title)
    });
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

// Scrape homepage - latest episodes
async function scrapeHomepage(page = 1) {
    try {
        const url = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
        const $ = await fetchPage(url);

        const episodes = [];

        // Nekopoi.care menggunakan struktur .eropost untuk episode list
        $('.eropost').each((_, element) => {
            const $elem = $(element);

            // Cari title dari h2 > a
            const titleElem = $elem.find('.eroinfo h2 a').first();
            const title = cleanText(titleElem.text());
            const url = titleElem.attr('href');

            // Cari poster/thumbnail dari .eroimg img
            const poster = $elem.find('.eroimg img').first().attr('src');

            // Cari tanggal dari span pertama di .eroinfo
            const dateElem = $elem.find('.eroinfo span').first();
            const date = cleanText(dateElem.text());

            // Cari series link (span kedua biasanya berisi link series)
            const seriesLink = $elem.find('.eroinfo span:nth-child(3) a').first();
            const seriesTitle = seriesLink.length ? cleanText(seriesLink.text()) : '';

            if (title && url) {
                episodes.push({
                    title,
                    slug: extractSlugFromUrl(url),
                    poster: imageProxy(poster),
                    url,
                    date,
                    series: seriesTitle,
                    episode: parseEpisodeNumber(title)
                });
            }
        });

        // Fallback for current Nekopoi theme (.nk-post-card) while keeping legacy parser above.
        if (episodes.length === 0) {
            $('.nk-post-card').each((_, element) => {
                const $elem = $(element);
                const titleElem = $elem.find('.nk-post-meta h2 a, h2 a').first();
                const title = cleanText(titleElem.text());
                const url = titleElem.attr('href');
                const $thumb = $elem.find('.nk-thumb-crop').first();
                const poster = extractBackgroundImage($thumb.attr('style'))
                    || $elem.find('img').first().attr('src')
                    || $elem.find('img').first().attr('data-src');
                const date = cleanText($elem.find('.nk-post-meta > span').first().text());
                const seriesTitle = cleanText($elem.find('.nk-series-link').first().text());

                pushEpisode(episodes, { title, url, poster, date, series: seriesTitle });
            });
        }

        // Last-resort fallback for simple article/post markup.
        if (episodes.length === 0) {
            $('article h2 a[href], .post h2 a[href], h2 a[href]').each((_, element) => {
                const $link = $(element);
                const title = cleanText($link.text());
                const url = $link.attr('href');
                if (!url || !url.startsWith(BASE_URL)) return;

                const $container = $link.closest('article, .post, .nk-post-card, div');
                const $thumb = $container.find('.nk-thumb-crop').first();
                const poster = extractBackgroundImage($thumb.attr('style'))
                    || $container.find('img').first().attr('src')
                    || $container.find('img').first().attr('data-src');
                const date = cleanText($container.find('time, .date, .posted-on, span').first().text());

                pushEpisode(episodes, { title, url, poster, date });
            });
        }

        // Pagination info
        const totalPages = extractTotalPages($, page);
        const hasNextPage = $('.pagination .next, .nav-links .next, a.next, .page-numbers.next').length > 0 || page < totalPages;
        const hasPrevPage = page > 1;

        return {
            status: 'success',
            data: {
                episodes,
                currentPage: page,
                totalPages,
                hasNextPage,
                hasPrevPage
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message
        };
    }
}

module.exports = { scrapeHomepage };
