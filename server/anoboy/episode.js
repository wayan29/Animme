// Anoboy Episode Page Scraper
const { BASE_URL, imageProxy, fetchPage, cleanText } = require('./helpers');

/**
 * Scrape episode page
 */
async function scrapeEpisode(slug) {
    try {
        const url = `${BASE_URL}/${slug}/`;
        console.log(`[Anoboy] Scraping episode: ${url}`);

        const $ = await fetchPage(url);

        // Extract episode info
        const title = cleanText($('.entry-title, h1.title').first().text());
        const animeTitle = cleanText($('.anime-title, .allc a').first().text());

        // Extract video sources
        const videoSources = [];

        // Method 1: iframe sources
        $('iframe').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src && !src.includes('about:blank')) {
                videoSources.push({
                    provider: getProviderFromUrl(src),
                    url: src,
                    quality: 'default'
                });
            }
        });

        // Method 2: video tags
        $('video source, video').each((i, el) => {
            const src = $(el).attr('src');
            if (src) {
                videoSources.push({
                    provider: 'direct',
                    url: src,
                    quality: $(el).attr('data-quality') || 'default'
                });
            }
        });

        // Method 3: download links
        const downloadLinks = [];
        $('.download-eps li a, .dls li a, .dlx a').each((i, el) => {
            const $el = $(el);
            const quality = cleanText($el.text());
            const url = $el.attr('href');

            if (url) {
                downloadLinks.push({
                    quality,
                    url,
                    provider: getProviderFromUrl(url)
                });
            }
        });

        // Extract navigation (prev/next episode)
        const navigation = {
            prev_episode: null,
            next_episode: null
        };

        const $prevLink = $('.naveps .nvs.nvsc a[rel="prev"], .ep-nav .prev a').first();
        const $nextLink = $('.naveps .nvs.nvsc a[rel="next"], .ep-nav .next a').first();

        if ($prevLink.length > 0) {
            navigation.prev_episode = {
                title: cleanText($prevLink.text()),
                url: $prevLink.attr('href'),
                slug: $prevLink.attr('href')?.split('/').filter(Boolean).pop()
            };
        }

        if ($nextLink.length > 0) {
            navigation.next_episode = {
                title: cleanText($nextLink.text()),
                url: $nextLink.attr('href'),
                slug: $nextLink.attr('href')?.split('/').filter(Boolean).pop()
            };
        }

        const episodeData = {
            title,
            anime_title: animeTitle,
            video_sources: videoSources,
            download_links: downloadLinks,
            navigation
        };

        console.log(`[Anoboy] Episode scraped: ${title}`);
        console.log(`[Anoboy] Found ${videoSources.length} video sources, ${downloadLinks.length} download links`);

        return {
            status: 'success',
            data: episodeData
        };
    } catch (error) {
        console.error('[Anoboy] Error scraping episode:', error.message);
        return {
            status: 'error',
            message: error.message,
            data: null
        };
    }
}

/**
 * Detect video provider from URL
 */
function getProviderFromUrl(url) {
    if (!url) return 'unknown';

    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
    if (lowerUrl.includes('blogger.com') || lowerUrl.includes('blogspot.com')) return 'blogger';
    if (lowerUrl.includes('drive.google.com')) return 'google-drive';
    if (lowerUrl.includes('fembed') || lowerUrl.includes('feurl')) return 'fembed';
    if (lowerUrl.includes('streamtape')) return 'streamtape';
    if (lowerUrl.includes('mp4upload')) return 'mp4upload';
    if (lowerUrl.includes('solidfiles')) return 'solidfiles';
    if (lowerUrl.includes('mega.nz')) return 'mega';
    if (lowerUrl.includes('zippyshare')) return 'zippyshare';
    if (lowerUrl.includes('mediafire')) return 'mediafire';

    return 'other';
}

module.exports = {
    scrapeEpisode
};
