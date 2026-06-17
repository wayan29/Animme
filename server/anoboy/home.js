// Anoboy Home Page Scraper
const { BASE_URL, imageProxy, fetchPage, extractSlugFromUrl, cleanText } = require('./helpers');

/**
 * Scrape latest anime releases from homepage
 */
async function scrapeLatestReleases(page = 1) {
    try {
        const url = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
        console.log(`[Anoboy] Scraping latest releases: ${url}`);

        const $ = await fetchPage(url);
        const releases = [];

        // Get first .listupd section (Latest Release)
        $('.listupd').first().find('article.bs, .bs').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const $img = $el.find('img').first();
            const $episode = $el.find('.epx, .bt .epx').first();
            const $type = $el.find('.type').first();

            // Get title from h2 (most accurate, avoids duplication)
            let title = cleanText($el.find('h2').first().text());
            if (!title) {
                title = cleanText($link.attr('title') || '');
            }

            const url = $link.attr('href') || '';
            const image = $img.attr('src') || $img.attr('data-src') || '';
            const episode = cleanText($episode.text());
            const type = cleanText($type.text());

            if (title && url) {
                releases.push({
                    title,
                    slug: extractSlugFromUrl(url),
                    url,
                    poster: imageProxy(image),
                    episode,
                    type
                });
            }
        });

        // Get pagination info using correct selector
        const $nextBtn = $('.hpage a.r').first();
        const pagination = {
            current_page: page,
            has_next_page: $nextBtn.length > 0,
            has_previous_page: page > 1,
            next_page_url: $nextBtn.length > 0 ? $nextBtn.attr('href') : null
        };

        console.log(`[Anoboy] Found ${releases.length} latest releases`);
        return { releases, pagination };
    } catch (error) {
        console.error('[Anoboy] Error scraping latest releases:', error.message);
        throw error;
    }
}

/**
 * Scrape recommendation section from homepage (second .listupd)
 */
async function scrapeRecommendation() {
    try {
        console.log('[Anoboy] Scraping recommendation');
        const $ = await fetchPage(BASE_URL);
        const recommendations = [];

        // Get second .listupd section (Recommendation)
        $('.listupd').eq(1).find('article.bs, .bs').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const $img = $el.find('img').first();
            const $type = $el.find('.type').first();
            const $score = $el.find('.score, .rating').first();

            // Get title from h2 (most accurate)
            let title = cleanText($el.find('h2').first().text());
            if (!title) {
                title = cleanText($link.attr('title') || '');
            }

            const url = $link.attr('href') || '';
            const image = $img.attr('src') || $img.attr('data-src') || '';
            const type = cleanText($type.text());
            const score = cleanText($score.text());

            if (title && url) {
                recommendations.push({
                    title,
                    slug: extractSlugFromUrl(url),
                    url,
                    poster: imageProxy(image),
                    type,
                    score
                });
            }
        });

        console.log(`[Anoboy] Found ${recommendations.length} recommendations`);
        return recommendations;
    } catch (error) {
        console.error('[Anoboy] Error scraping recommendation:', error.message);
        throw error;
    }
}

/**
 * Scrape ongoing anime from sidebar
 */
async function scrapeOngoing() {
    try {
        console.log('[Anoboy] Scraping ongoing anime');
        const $ = await fetchPage(BASE_URL);
        const ongoing = [];

        $('#sidebar .widget .serieslist li, #sidebar .section .ongoingseries li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const $img = $el.find('img').first();
            const $title = $link.find('.leftseries .tt, h2').first();
            const $episode = $link.find('.epx, .r').first();

            const title = cleanText($title.text() || $link.attr('title') || '');
            const url = $link.attr('href') || '';
            const image = $img.attr('src') || $img.attr('data-src') || '';
            const episode = cleanText($episode.text());

            if (title && url) {
                ongoing.push({
                    title,
                    slug: extractSlugFromUrl(url),
                    url,
                    poster: imageProxy(image),
                    episode
                });
            }
        });

        console.log(`[Anoboy] Found ${ongoing.length} ongoing anime`);
        return ongoing;
    } catch (error) {
        console.error('[Anoboy] Error scraping ongoing:', error.message);
        throw error;
    }
}

/**
 * Scrape complete homepage data
 */
async function scrapeHomepage(page = 1) {
    try {
        console.log(`[Anoboy] Scraping homepage (page ${page})`);

        const [latestData, recommendations] = await Promise.all([
            scrapeLatestReleases(page),
            page === 1 ? scrapeRecommendation() : Promise.resolve([])
        ]);

        return {
            status: 'success',
            data: {
                latest_releases: latestData.releases,
                recommendations: recommendations,
                pagination: latestData.pagination
            }
        };
    } catch (error) {
        console.error('[Anoboy] Error scraping homepage:', error.message);
        return {
            status: 'error',
            message: error.message,
            data: {
                latest_releases: [],
                recommendations: [],
                pagination: {}
            }
        };
    }
}

module.exports = {
    scrapeLatestReleases,
    scrapeRecommendation,
    scrapeOngoing,
    scrapeHomepage
};
