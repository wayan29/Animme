const cheerio = require('cheerio');
const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl } = require('./helpers');

// Scrape banner recommendations from homepage slider
async function scrapeBannerRecommendations() {
    try {
        console.log('[Anichin] Scraping banner recommendations...');
        const html = await fetchPage(BASE_URL);
        const $ = cheerio.load(html);

        const banners = [];

        // Get items from swiper slider
        for (let i = 0; i < $('.swiper-slide.item').length; i++) {
            const $item = $($('.swiper-slide.item')[i]);

            // Get backdrop image
            const backdrop = $item.find('.backdrop').css('background-image');
            const backdropUrl = backdrop ? backdrop.replace(/url\(['"]?(.*?)['"]?\)/, '$1') : '';

            // Get title and Japanese title
            const titleElement = $item.find('h2 a');
            const title = titleElement.text().trim();
            const japaneseTitle = titleElement.attr('data-jtitle') || '';

            // Get URL and slug
            const url = titleElement.attr('href') || '';
            const slug = extractSlugFromUrl(url);

            // Get description
            const description = $item.find('p').text().trim();

            // Get watch button URL
            const watchUrl = $item.find('.watch').attr('href') || '';

            if (title && url) {
                // Process backdrop image through proxy
                const cachedBackdrop = await imageProxy.processPosterUrl(backdropUrl);

                banners.push({
                    title: title,
                    japanese_title: japaneseTitle,
                    slug: slug,
                    url: url,
                    backdrop: cachedBackdrop,
                    description: description,
                    watch_url: watchUrl,
                    type: 'banner'
                });
            }
        }

        console.log(`[Anichin] Found ${banners.length} banner recommendations`);
        return banners;
    } catch (error) {
        console.error('[Anichin] Error scraping banner recommendations:', error.message);
        return [];
    }
}

// Scrape popular today from homepage
async function scrapePopularToday() {
    try {
        console.log('[Anichin] Scraping popular today...');
        const html = await fetchPage(BASE_URL);
        const $ = cheerio.load(html);

        const popularToday = [];

        // Look for Popular Today section items
        const popularLinks = $('.releases.hothome').nextUntil('.releases.latesthome').find('a');

        for (let i = 0; i < popularLinks.length; i++) {
            const $item = $(popularLinks[i]);
            const url = $item.attr('href') || '';

            // Skip if not an episode link or if it's the "View All" link
            if (!url || url.includes('/seri/?') || url.includes('/page/')) {
                continue;
            }

            // Get title from the link text or nested elements
            let title = '';
            let episode = '';
            let poster = '';

            // Try to get title from img alt or text content
            const imgElement = $item.find('img');
            if (imgElement.length) {
                title = imgElement.attr('alt') || '';
                poster = imgElement.attr('src') || '';
            }

            // Get episode info from text content
            const textContent = $item.text().trim();
            const episodeMatch = textContent.match(/Ep\s*(\d+)/i);
            if (episodeMatch) {
                episode = `Episode ${episodeMatch[1]}`;
            }

            // Extract anime title from episode title
            if (title) {
                // Remove episode info from title
                title = title.replace(/Episode\s*\d+\s*Subtitle\s*Indonesia/i, '').trim();
            }

            // Get slug from URL - extract anime name from episode URL
            let slug = '';
            const urlParts = url.replace(BASE_URL, '').replace(/^\//, '').split('/');
            if (urlParts.length > 0) {
                // Remove episode-specific parts and get anime slug
                slug = urlParts[0];
                // Remove common episode patterns
                slug = slug.replace(/-episode-\d+.*$/, '');
            }

            if (title && url) {
                // Process poster image through proxy
                const cachedPoster = await imageProxy.processPosterUrl(poster);

                popularToday.push({
                    title: title,
                    slug: slug,
                    url: url,
                    poster: cachedPoster,
                    episode: episode,
                    type: 'Donghua',
                    category: 'popular_today'
                });
            }
        }

        console.log(`[Anichin] Found ${popularToday.length} popular today items`);
        return popularToday;
    } catch (error) {
        console.error('[Anichin] Error scraping popular today:', error.message);
        return [];
    }
}

// Scrape latest releases from homepage
async function scrapeLatestReleases() {
    try {
        console.log('[Anichin] Scraping latest releases...');
        const html = await fetchPage(BASE_URL);
        const $ = cheerio.load(html);

        const latestReleases = [];

        // Look for Latest Release section items
        const latestLinks = $('.releases.latesthome').nextUntil('.releases').find('a');

        for (let i = 0; i < latestLinks.length; i++) {
            const $item = $(latestLinks[i]);
            const url = $item.attr('href') || '';

            // Skip if not an episode link or if it's the "View All" link
            if (!url || url.includes('/seri/?') || url.includes('/page/')) {
                continue;
            }

            // Get title from the link text or nested elements
            let title = '';
            let episode = '';
            let poster = '';

            // Try to get title from img alt or text content
            const imgElement = $item.find('img');
            if (imgElement.length) {
                title = imgElement.attr('alt') || '';
                poster = imgElement.attr('src') || '';
            }

            // Get episode info from text content
            const textContent = $item.text().trim();
            const episodeMatch = textContent.match(/Ep\s*(\d+)/i);
            if (episodeMatch) {
                episode = `Episode ${episodeMatch[1]}`;
            }

            // Extract anime title from episode title
            if (title) {
                // Remove episode info from title
                title = title.replace(/Episode\s*\d+\s*Subtitle\s*Indonesia/i, '').trim();
            }

            // Get slug from URL - extract anime name from episode URL
            let slug = '';
            const urlParts = url.replace(BASE_URL, '').replace(/^\//, '').split('/');
            if (urlParts.length > 0) {
                // Remove episode-specific parts and get anime slug
                slug = urlParts[0];
                // Remove common episode patterns
                slug = slug.replace(/-episode-\d+.*$/, '');
            }

            if (title && url) {
                // Process poster image through proxy
                const cachedPoster = await imageProxy.processPosterUrl(poster);

                latestReleases.push({
                    title: title,
                    slug: slug,
                    url: url,
                    poster: cachedPoster,
                    episode: episode,
                    type: 'Donghua',
                    category: 'latest_release'
                });
            }
        }

        console.log(`[Anichin] Found ${latestReleases.length} latest releases`);
        return latestReleases;
    } catch (error) {
        console.error('[Anichin] Error scraping latest releases:', error.message);
        return [];
    }
}

// Get all homepage data in one call
async function scrapeHomepage() {
    try {
        console.log('[Anichin] Scraping complete homepage data...');

        const [bannerRecommendations, popularToday, latestReleases] = await Promise.all([
            scrapeBannerRecommendations(),
            scrapePopularToday(),
            scrapeLatestReleases()
        ]);

        return {
            status: 'success',
            data: {
                banner_recommendations: bannerRecommendations,
                popular_today: popularToday,
                latest_releases: latestReleases,
                total_banners: bannerRecommendations.length,
                total_popular: popularToday.length,
                total_latest: latestReleases.length
            }
        };
    } catch (error) {
        console.error('[Anichin] Error scraping homepage:', error.message);
        return {
            status: 'error',
            message: error.message,
            data: {
                banner_recommendations: [],
                popular_today: [],
                latest_releases: []
            }
        };
    }
}

module.exports = {
    scrapeBannerRecommendations,
    scrapePopularToday,
    scrapeLatestReleases,
    scrapeHomepage
};
