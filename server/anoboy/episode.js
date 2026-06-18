// Anoboy Episode Page Scraper
const { BASE_URL, imageProxy, fetchPage, cleanText, extractSlugFromUrl } = require('./helpers');

/**
 * Scrape episode page
 */
async function scrapeEpisode(slug) {
    try {
        const url = `${BASE_URL}/${slug}/`;
        console.log(`[Anoboy] Scraping episode: ${url}`);

        const $ = await fetchPage(url);
        const currentSlug = slug;

        // Extract episode info
        const title = cleanText($('.entry-title, h1.title').first().text());
        const animeTitle = cleanText($('.anime-title, .allc a').first().text());

        // Extract video sources
        const videoSources = [];
        const seenSourceUrls = new Set();

        function addVideoSource(provider, src, quality) {
            if (!src || seenSourceUrls.has(src)) return;
            seenSourceUrls.add(src);
            videoSources.push({
                provider: provider || getProviderFromUrl(src),
                url: src,
                quality: quality || 'default'
            });
        }

        // Method 1: iframe sources
        $('iframe').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src && !src.includes('about:blank')) {
                addVideoSource(getProviderFromUrl(src), src, 'default');
            }
        });

        // Method 2: video tags
        $('video source, video').each((i, el) => {
            const src = $(el).attr('src');
            if (src) {
                addVideoSource('direct', src, $(el).attr('data-quality') || 'default');
            }
        });

        // Method 3: base64-encoded iframe inside <select><option>
        $('select option').each((i, el) => {
            const value = $(el).attr('value') || '';
            if (!value || value.length < 20) return;
            try {
                const decoded = Buffer.from(value, 'base64').toString('utf8');
                const match = decoded.match(/<iframe[^>]+src=["']([^"']+)["']/i);
                if (match && match[1]) {
                    addVideoSource(getProviderFromUrl(match[1]), match[1], cleanText($(el).text()) || 'default');
                }
            } catch (_) {}
        });

        function cleanEpisodeTitle(text) {
            if (!text) return '';
            let t = text;
            t = t.replace(/\bPrev\b|\bNext\b/gi, ' ');
            t = t.replace(/\bEps?\s*\d+\s*[-–]\s*[^,]*,?/gi, ' ');
            t = t.replace(/\s+/g, ' ').trim();
            return t;
        }

        function extractEpisodeNumber(text) {
            if (!text) return '';
            const m = text.match(/episode\s+(\d+(?:\.\d+)?)/i);
            return m ? m[1] : '';
        }

        const episodeList = [];
        const seenEpisodes = new Set();

        const $episodeCandidates = $('a[href*="episode"], a[title*="episode"], a[title*="Episode"]');

        $episodeCandidates.each((i, el) => {
            const $link = $(el);
            const href = $link.attr('href') || '';
            const titleAttr = $link.attr('title') || '';
            const linkText = cleanText($link.text());
            const episodeTitle = cleanEpisodeTitle(titleAttr || linkText);

            if (!href || !episodeTitle) return;
            if (!/episode/i.test(href) && !/episode/i.test(episodeTitle)) return;

            const itemSlug = extractSlugFromUrl(href);
            if (!itemSlug || seenEpisodes.has(itemSlug)) return;

            seenEpisodes.add(itemSlug);

            episodeList.push({
                title: episodeTitle,
                episode: extractEpisodeNumber(episodeTitle),
                url: href,
                slug: itemSlug,
                is_current: itemSlug === currentSlug
            });
        });

        // If we have no entries via strict link scan, try sibling list blocks
        if (!episodeList.length) {
            $('.serieslist li a, .bixbox .listupd li a, .listupd .bs a, .episodelist li a').each((i, el) => {
                const $link = $(el);
                const href = $link.attr('href') || '';
                const titleAttr = $link.attr('title') || '';
                const linkText = cleanText($link.text());
                const episodeTitle = cleanEpisodeTitle(titleAttr || linkText);

                if (!href || !episodeTitle) return;
                if (!/episode/i.test(href) && !/episode/i.test(episodeTitle)) return;

                const itemSlug = extractSlugFromUrl(href);
                if (!itemSlug || seenEpisodes.has(itemSlug)) return;

                seenEpisodes.add(itemSlug);

                episodeList.push({
                    title: episodeTitle,
                    episode: extractEpisodeNumber(episodeTitle),
                    url: href,
                    slug: itemSlug,
                    is_current: itemSlug === currentSlug
                });
            });
        }

        let recommendationRoot = $('.listupd').eq(1);
        if (!recommendationRoot.length) {
            $('.bixbox').each((i, el) => {
                const heading = cleanText($(el).find('.releases h2, h2, h3').first().text());
                if (/recommend|related/i.test(heading)) {
                    recommendationRoot = $(el);
                    return false;
                }
            });
        }

        const recommendations = [];
        const seenRecommendations = new Set();

        recommendationRoot.find('article.bs, .bs, .listupd article, .animepost').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const $img = $el.find('img').first();
            const recTitle = cleanText($el.find('h2, .tt, .series-title').first().text()) || cleanText($link.attr('title') || '') || cleanText($link.text());
            const recUrl = $link.attr('href') || '';
            const image = $img.attr('src') || $img.attr('data-src') || '';
            const recType = cleanText($el.find('.type, .genre').first().text());
            const recScore = cleanText($el.find('.score, .rating').first().text());

            if (!recTitle || !recUrl) return;
            const recSlug = extractSlugFromUrl(recUrl);
            if (!recSlug || seenRecommendations.has(recSlug)) return;

            seenRecommendations.add(recSlug);

            recommendations.push({
                title: recTitle,
                slug: recSlug,
                url: recUrl,
                poster: imageProxy(image),
                type: recType,
                score: recScore
            });
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
            navigation,
            episodes: episodeList,
            episode_list: episodeList,
            recommendations,
            recommended_series: recommendations
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
