const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText } = require('./helpers');

// Search anime/episodes
async function scrapeSearch(query) {
    try {
        const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const $ = await fetchPage(searchUrl);

        const results = [];

        // Parse search results
        $('.post, article, .search-item, .search-result').each((_, element) => {
            const $elem = $(element);

            // Title and URL
            const $titleLink = $elem.find('h2 a, h3 a, .entry-title a, .title a').first();
            const title = cleanText($titleLink.text() || $titleLink.attr('title'));
            const url = $titleLink.attr('href');

            // Thumbnail
            const poster = $elem.find('img').first().attr('src') || $elem.find('img').first().attr('data-src');

            // Excerpt/Description
            const excerpt = cleanText($elem.find('.excerpt, .entry-summary, .description, p').first().text());

            // Date
            const date = cleanText($elem.find('.date, .post-date, time').first().text());

            // Categories/Genres
            const categories = [];
            $elem.find('.category a, .cat-links a, a[rel="category"]').each((_, catElem) => {
                categories.push(cleanText($(catElem).text()));
            });

            if (title && url) {
                results.push({
                    title,
                    slug: extractSlugFromUrl(url),
                    poster: imageProxy(poster),
                    url,
                    excerpt,
                    date,
                    categories
                });
            }
        });

        // Jika tidak ada hasil dengan selector di atas, coba struktur alternatif
        if (results.length === 0) {
            $('article, .item, .post-item').each((_, element) => {
                const $elem = $(element);
                const $link = $elem.find('a[href]').first();
                const title = cleanText($link.attr('title') || $link.find('h2, h3').text() || $link.text());
                const url = $link.attr('href');
                const poster = $elem.find('img').attr('src') || $elem.find('img').attr('data-src');

                if (title && url && url.includes(BASE_URL)) {
                    results.push({
                        title,
                        slug: extractSlugFromUrl(url),
                        poster: imageProxy(poster),
                        url
                    });
                }
            });
        }

        return {
            status: 'success',
            data: {
                query,
                results,
                totalResults: results.length
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message
        };
    }
}

module.exports = { scrapeSearch };
