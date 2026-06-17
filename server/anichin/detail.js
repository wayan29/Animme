const cheerio = require('cheerio');
const { BASE_URL, fetchPage, imageProxy } = require('./helpers');

// Scrape anime detail page
async function scrapeAnimeDetail(slug) {
    try {
        console.log(`[Anichin] Scraping anime detail for: ${slug}`);
        const url = `${BASE_URL}/seri/${slug}/`;
        const html = await fetchPage(url);
        const $ = cheerio.load(html);

        // Get main title
        const title = $('.entry-title').text().trim();

        // Get alternative title
        const alternativeTitle = $('.entry-title').attr('data-jtitle') || '';

        // Get poster
        const posterUrl = $('.thumb img').attr('src') || '';

        // Get description
        const description = $('.entry-content p').first().text().trim();

        // Get info details
        const info = {};
        $('.infox .spe span').each((i, element) => {
            const $span = $(element);
            const label = $span.contents().first().text().trim().replace(':', '');
            const value = $span.find('a').text().trim() || $span.contents().eq(1).text().trim();

            if (label && value) {
                info[label.toLowerCase()] = value;
            }
        });

        // Get episode list
        const episodes = [];
        $('.eplister li').each((i, element) => {
            const $episode = $(element);
            const episodeUrl = $episode.find('a').attr('href') || '';
            const episodeTitle = $episode.find('.epl-num').text().trim();
            const episodeDate = $episode.find('.epl-date').text().trim();

            if (episodeUrl) {
                episodes.push({
                    title: episodeTitle,
                    url: episodeUrl,
                    date: episodeDate
                });
            }
        });

        // Process poster through image proxy
        const cachedPoster = await imageProxy.processPosterUrl(posterUrl);

        return {
            status: 'success',
            data: {
                title: title,
                alternative_title: alternativeTitle,
                slug: slug,
                poster: cachedPoster,
                description: description,
                info: info,
                episodes: episodes,
                total_episodes: episodes.length
            }
        };
    } catch (error) {
        console.error(`[Anichin] Error scraping anime detail for ${slug}:`, error.message);
        return {
            status: 'error',
            message: error.message,
            data: null
        };
    }
}

module.exports = {
    scrapeAnimeDetail
};
