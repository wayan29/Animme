const cheerio = require('cheerio');
const { BASE_URL, fetchPage } = require('./helpers');

// Scrape episode page
async function scrapeEpisode(slug) {
    try {
        console.log(`[Anichin] Scraping episode: ${slug}`);
        const url = `${BASE_URL}/${slug}`;
        const html = await fetchPage(url);
        const $ = cheerio.load(html);

        // Get episode title
        const episodeTitle = $('.entry-title').text().trim();

        // Extract anime title and episode number from title
        // Example: "Supreme Alchemy Episode 167 Subtitle Indonesia"
        let animeTitle = episodeTitle;
        let episodeNum = '';
        const episodeMatch = episodeTitle.match(/(.*?)\s+Episode\s+(\d+)/i);
        if (episodeMatch) {
            animeTitle = episodeMatch[1].trim();
            episodeNum = episodeMatch[2];
        }

        // Get streaming servers from select options
        const streamingServers = [];
        const seenServerUrls = new Set();

        const extractVideoUrlFromValue = (value) => {
            if (!value) {
                return '';
            }

            let decoded = value;
            const sanitized = value.replace(/\s+/g, '');
            const base64Pattern = /^[A-Za-z0-9+/=]+$/;

            if (sanitized && base64Pattern.test(sanitized) && sanitized.length >= 8) {
                try {
                    const buffer = Buffer.from(sanitized, 'base64');
                    const possible = buffer.toString('utf8');

                    if (possible && (possible.includes('http') || possible.includes('<'))) {
                        decoded = possible;
                    }
                } catch (error) {
                    // Ignore base64 decoding errors and fall back to raw value
                    decoded = value;
                }
            }

            if (!decoded) {
                return '';
            }

            // Try to parse with cheerio to find iframe/source tags
            try {
                const snippet$ = cheerio.load(decoded);
                const iframeSrc = snippet$('iframe').attr('src');
                if (iframeSrc) {
                    return iframeSrc.trim();
                }

                const sourceSrc = snippet$('source').attr('src');
                if (sourceSrc) {
                    return sourceSrc.trim();
                }

                const videoSrc = snippet$('video').attr('src');
                if (videoSrc) {
                    return videoSrc.trim();
                }
            } catch (error) {
                // Continue with regex fallback below
            }

            const srcMatch = decoded.match(/src=["']([^"']+)["']/i);
            if (srcMatch && srcMatch[1]) {
                return srcMatch[1].trim();
            }

            const urlMatch = decoded.match(/https?:\/\/[^\s"'<>]+/i);
            if (urlMatch && urlMatch[0]) {
                return urlMatch[0].trim();
            }

            return '';
        };

        $('.megavid select option').each((i, option) => {
            const $option = $(option);
            const serverName = $option.text().trim();
            const value = $option.attr('value') || '';

            // Skip placeholder option
            if (!serverName || serverName === 'Select Video Server') {
                return;
            }

            const videoUrl = extractVideoUrlFromValue(value);

            if (videoUrl) {
                const serverKey = `${serverName}::${videoUrl}`;
                if (!seenServerUrls.has(serverKey)) {
                    streamingServers.push({
                        name: serverName,
                        sources: [{
                            url: videoUrl,
                            quality: 'default'
                        }]
                    });
                    seenServerUrls.add(serverKey);
                }
            }
        });

        // Fallback: include currently embedded iframe if no servers were found
        if (streamingServers.length === 0) {
            const fallbackUrl = $('#embed_holder iframe').attr('src') ||
                $('.player-embed iframe').attr('src') ||
                $('.video-content iframe').attr('src') ||
                '';

            if (fallbackUrl) {
                streamingServers.push({
                    name: 'Default',
                    sources: [{
                        url: fallbackUrl,
                        quality: 'default'
                    }]
                });
            }
        }

        // Get download links from entry-content
        const downloadLinks = [];
        const $content = $('.entry-content');

        // Find all strong tags that contain quality info
        $content.find('strong').each((i, el) => {
            const $strong = $(el);
            const text = $strong.text().trim();

            // Check if this is a quality indicator
            if (text.match(/^(360p|480p|720p|1080p)$/)) {
                const quality = text;

                // Find download links in the same paragraph or next elements
                const $parent = $strong.parent();
                $parent.find('a[href*="mirror"], a[href*="terabox"], a[href*="drive"], a[href*="download"]').each((j, link) => {
                    const $link = $(link);
                    const provider = $link.text().trim();
                    const downloadUrl = $link.attr('href') || '';

                    if (downloadUrl && provider) {
                        downloadLinks.push({
                            quality: quality,
                            provider: provider,
                            url: downloadUrl
                        });
                    }
                });
            }
        });

        // Get episode list from sidebar
        const episodeList = [];
        $('.eplister li').each((i, element) => {
            const $episode = $(element);
            const episodeUrl = $episode.find('a').attr('href') || '';
            const episodeTitle = $episode.find('.epl-num').text().trim();
            const episodeDate = $episode.find('.epl-date').text().trim();

            // Check if this is the current episode
            const isActive = episodeUrl.includes(slug) || slug.includes(episodeUrl.split('/').pop());

            if (episodeUrl) {
                episodeList.push({
                    title: episodeTitle,
                    url: episodeUrl,
                    date: episodeDate,
                    is_active: isActive
                });
            }
        });

        // Get navigation (prev/next episode)
        const navigation = {};
        $('.nvs.nvsc a').each((i, link) => {
            const $link = $(link);
            const rel = $link.attr('rel');
            const href = $link.attr('href') || '';

            if (rel === 'prev' && href) {
                navigation.prev_episode = {
                    url: href,
                    title: $link.text().trim()
                };
            } else if (rel === 'next' && href) {
                navigation.next_episode = {
                    url: href,
                    title: $link.text().trim()
                };
            }
        });

        // Get anime detail URL
        const animeDetailUrl = $('.nvs.nvsc a[rel="prev"], .nvs.nvsc a[rel="next"]').first().attr('href') || '';
        let detailUrl = '';
        if (animeDetailUrl) {
            // Extract anime slug from episode URL
            // Example: /supreme-alchemy-episode-167/ -> /seri/supreme-alchemy/
            const animeSlugMatch = slug.match(/^(.+?)-episode-/);
            if (animeSlugMatch) {
                detailUrl = animeSlugMatch[1];
            }
        }

        return {
            status: 'success',
            data: {
                title: episodeTitle,
                anime_title: animeTitle,
                episode_title: episodeNum ? `Episode ${episodeNum}` : episodeTitle,
                episode_number: episodeNum,
                slug: slug,
                streaming_servers: streamingServers,
                download_links: downloadLinks,
                episode_list: episodeList,
                navigation: navigation,
                anime_detail_url: detailUrl ? `/v4/detail?slug=${detailUrl}` : ''
            }
        };
    } catch (error) {
        console.error(`[Anichin] Error scraping episode ${slug}:`, error.message);
        return {
            status: 'error',
            message: error.message,
            data: null
        };
    }
}

module.exports = {
    scrapeEpisode
};
