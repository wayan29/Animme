const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText, parseEpisodeNumber } = require('./helpers');

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

        // Pagination info
        const hasNextPage = $('.pagination .next, .nav-links .next, a.next').length > 0;
        const hasPrevPage = page > 1;

        return {
            status: 'success',
            data: {
                episodes,
                currentPage: page,
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
