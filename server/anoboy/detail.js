// Anoboy Detail Page Scraper
const { BASE_URL, imageProxy, fetchPage, cleanText } = require('./helpers');

/**
 * Scrape anime detail page
 */
async function scrapeAnimeDetail(slug) {
    try {
        const url = `${BASE_URL}/${slug}/`;
        console.log(`[Anoboy] Scraping anime detail: ${url}`);

        const $ = await fetchPage(url);

        // Extract basic info
        const title = cleanText($('.entry-title, h1.title').first().text());
        const alternativeTitle = cleanText($('.alter, .alternative-title').first().text());
        const poster = imageProxy($('.thumb img, .infox img').first().attr('src'));

        // Extract info from table
        const info = {};
        $('.info-content .spe span, .infox .spe span').each((i, el) => {
            const $el = $(el);
            const label = cleanText($el.find('b').text()).replace(':', '').toLowerCase();
            const value = cleanText($el.clone().children().remove().end().text());

            if (label && value) {
                info[label] = value;
            }
        });

        // Extract genres
        const genres = [];
        $('.genxed a, .genre-info a').each((i, el) => {
            const genre = cleanText($(el).text());
            if (genre) genres.push(genre);
        });

        // Extract synopsis
        const synopsis = cleanText($('.entry-content p, .sinops p, .desc p').first().text());

        // Extract episode list
        const episodes = [];
        $('.eplister ul li, .episodelist ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const $num = $el.find('.epl-num, .epl-title').first();
            const $date = $el.find('.epl-date, .date').first();

            const episodeTitle = cleanText($num.text() || $link.attr('title') || '');
            const episodeUrl = $link.attr('href') || '';
            const releaseDate = cleanText($date.text());

            if (episodeTitle && episodeUrl) {
                episodes.push({
                    episode: episodeTitle,
                    url: episodeUrl,
                    slug: episodeUrl.split('/').filter(Boolean).pop(),
                    release_date: releaseDate
                });
            }
        });

        const detailData = {
            title,
            alternative_title: alternativeTitle,
            poster,
            synopsis,
            genres,
            status: info['status'] || '',
            type: info['type'] || info['tipe'] || '',
            total_episodes: info['total episode'] || info['episode'] || '',
            duration: info['duration'] || info['durasi'] || '',
            release_date: info['released'] || info['tanggal rilis'] || '',
            studio: info['studio'] || '',
            producer: info['produser'] || info['producer'] || '',
            score: info['score'] || '',
            episodes: episodes.reverse() // Reverse to show from episode 1
        };

        console.log(`[Anoboy] Detail scraped: ${title} (${episodes.length} episodes)`);
        return {
            status: 'success',
            data: detailData
        };
    } catch (error) {
        console.error('[Anoboy] Error scraping detail:', error.message);
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
