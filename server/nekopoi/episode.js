const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText } = require('./helpers');

// Scrape episode detail (alias for anime detail since nekopoi is episode-based)
async function scrapeEpisode(slug) {
    try {
        const url = `${BASE_URL}/${slug}/`;
        const $ = await fetchPage(url);

        // Episode title
        const title = cleanText($('h1.entry-title, h1.title, .single-title h1').first().text());

        // Thumbnail
        const thumbnail = $('.entry-content img, .thumbnail img, article img').first().attr('src') ||
                          $('.entry-content img, .thumbnail img, article img').first().attr('data-src');

        // Description
        const description = cleanText($('.entry-content p, .synopsis, .description').first().text());

        // Extract video info
        const videoInfo = {};
        $('.video-info li, .info-item, .detail-info li').each((_, elem) => {
            const $elem = $(elem);
            const label = cleanText($elem.find('.label, strong, b').text()).replace(':', '');
            const value = cleanText($elem.clone().children().remove().end().text());
            if (label && value) {
                videoInfo[label.toLowerCase()] = value;
            }
        });

        // Stream URLs
        const streamUrls = [];
        $('iframe[src], .video-player iframe, .player iframe').each((_, elem) => {
            const src = $(elem).attr('src');
            if (src) {
                streamUrls.push({
                    provider: detectProvider(src),
                    url: src,
                    quality: 'Stream'
                });
            }
        });

        // Video sources from video tags
        $('video source, .video-player source').each((_, elem) => {
            const src = $(elem).attr('src');
            const type = $(elem).attr('type');
            if (src) {
                streamUrls.push({
                    provider: 'Direct',
                    url: src,
                    type: type || 'video/mp4',
                    quality: 'HD'
                });
            }
        });

        // Download links - Enhanced extraction
        const downloadLinks = [];
        
        // Method 1: Direct download links with common patterns
        $('a[href*="drive.google"], a[href*="zippyshare"], a[href*="mega.nz"], a[href*="mediafire"], a[href*="anonfiles"], a[href*="solidfiles"], a[href*="uptobox"], a[href*="files.im"], a[href*="gounlimited.to"], a[href*="mirrorace.com"]').each((_, elem) => {
            const $elem = $(elem);
            const text = cleanText($elem.text());
            const url = $elem.attr('href');

            if (url && !url.includes('#')) {
                downloadLinks.push({
                    quality: text || 'Download',
                    url,
                    host: extractHost(url)
                });
            }
        });

        // Method 2: Download links with class or text patterns
        $('.download-link a, .download-button a, .btn-download a, a[href*="download"]').each((_, elem) => {
            const $elem = $(elem);
            const text = cleanText($elem.text());
            const url = $elem.attr('href');

            if (url && !url.includes('#') && !url.includes('javascript:')) {
                downloadLinks.push({
                    quality: text || 'Download',
                    url,
                    host: extractHost(url)
                });
            }
        });

        // Method 3: Look for quality-specific download links (360p, 480p, 720p, 1080p)
        $('a').each((_, elem) => {
            const $elem = $(elem);
            const text = cleanText($elem.text());
            const url = $elem.attr('href');

            if (url && text && (text.includes('360p') || text.includes('480p') || text.includes('720p') || text.includes('1080p') || text.includes('HD') || text.includes('FHD') || text.includes('SD')) && !url.includes('#') && !url.includes('javascript:')) {
                // Extract quality from text
                let quality = text;
                if (text.includes('360p')) quality = '360p';
                else if (text.includes('480p')) quality = '480p';
                else if (text.includes('720p')) quality = '720p';
                else if (text.includes('1080p')) quality = '1080p';
                else if (text.includes('HD')) quality = 'HD';
                else if (text.includes('FHD')) quality = 'Full HD';
                else if (text.includes('SD')) quality = 'SD';

                downloadLinks.push({
                    quality: quality,
                    url: url,
                    host: extractHost(url)
                });
            }
        });

        // Method 4: Table/list based download links
        $('.download-list tr, .download-table tr, table tr').each((_, elem) => {
            const $elem = $(elem);
            const cells = $elem.find('td');
            const quality = cleanText($elem.find('td:first, .quality, [class*="quality"]').text());
            const $link = $elem.find('a[href]');
            const url = $link.attr('href');

            if (url && url !== '#' && !url.includes('javascript:') && (quality || cleanText($link.text()))) {
                downloadLinks.push({
                    quality: quality || cleanText($link.text()) || 'Download',
                    url: url,
                    host: extractHost(url)
                });
            }
        });

        // Method 5: Extract from lists or divs with download indicators
        $('li, div').each((_, elem) => {
            const $elem = $(elem);
            const text = cleanText($elem.text());
            const $link = $elem.find('a[href]');
            const url = $link.attr('href');

            // Look for download-related keywords
            if (url && (text.includes('Download') || text.includes('Unduh') || text.includes('Google Drive') || text.includes('Mega') || text.includes('Zippy') || text.includes('Mediafire')) && !url.includes('#') && !url.includes('javascript:')) {
                downloadLinks.push({
                    quality: text || 'Download',
                    url: url,
                    host: extractHost(url)
                });
            }
        });

        // Log original download links for debugging
        console.log(`[V7 Episode] Found ${downloadLinks.length} download links before filtering`);

        // Remove duplicates and invalid URLs
        const seenUrls = new Set();
        const cleanedDownloadLinks = downloadLinks.filter(link => {
            const url = link.url || '';
            const host = link.host || '';
            const quality = link.quality || '';

            // Skip if URL already seen
            if (seenUrls.has(url)) {
                return false;
            }

            // Skip if URL is empty or invalid
            if (!url || url === '#' || url.includes('javascript:')) {
                return false;
            }

            // Skip stream embed URLs (not downloadable)
            if (url.includes('fembed') || url.includes('femax') ||
                url.includes('streamtape') || url.includes('doodstream') ||
                url.includes('iframe') || url.includes('embed')) {
                return false;
            }

            // Skip if host indicates it's a stream source
            if (host === 'Stream Source' || host === 'Direct Source') {
                return false;
            }

            // Skip if quality indicates it's a stream
            if (quality === 'Stream' || quality === 'Stream Quality' ||
                quality === 'Direct Video') {
                return false;
            }

            // Only allow known file hosting services or direct video files
            const isKnownHost = url.includes('drive.google') || url.includes('mega.nz') ||
                              url.includes('mediafire') || url.includes('zippyshare') ||
                              url.includes('anonfiles') || url.includes('solidfiles') ||
                              url.includes('uptobox') || url.includes('mirrorace') ||
                              url.includes('files.im') || url.includes('gounlimited');

            const isDirectVideo = /\.(mp4|mkv|avi|webm)(\?|$)/i.test(url);

            if (!isKnownHost && !isDirectVideo) {
                return false;
            }

            seenUrls.add(url);
            return true;
        });

        console.log(`[V7 Episode] ${cleanedDownloadLinks.length} download links after filtering`);
        if (cleanedDownloadLinks.length > 0) {
            console.log('[V7 Episode] Valid download links:', cleanedDownloadLinks.map(l => `${l.quality} - ${l.host}`).join(', '));
        }

        // Tags/Genres
        const genres = [];
        $('a[rel="tag"], .genre a, .tags a, .category a').each((_, elem) => {
            const $elem = $(elem);
            genres.push({
                name: cleanText($elem.text()),
                slug: extractSlugFromUrl($elem.attr('href'))
            });
        });

        // Related/Previous/Next episodes
        const navigation = {
            prev: null,
            next: null
        };

        const prevLink = $('.nav-previous a, .prev-episode a, a[rel="prev"]').first();
        if (prevLink.length) {
            navigation.prev = {
                title: cleanText(prevLink.text() || prevLink.attr('title')),
                slug: extractSlugFromUrl(prevLink.attr('href')),
                url: prevLink.attr('href')
            };
        }

        const nextLink = $('.nav-next a, .next-episode a, a[rel="next"]').first();
        if (nextLink.length) {
            navigation.next = {
                title: cleanText(nextLink.text() || nextLink.attr('title')),
                slug: extractSlugFromUrl(nextLink.attr('href')),
                url: nextLink.attr('href')
            };
        }

        return {
            status: 'success',
            data: {
                title,
                slug,
                thumbnail: imageProxy(thumbnail),
                description,
                videoInfo,
                streamUrls,
                downloadLinks: cleanedDownloadLinks,
                genres,
                navigation
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message
        };
    }
}

// Helper: Detect video provider
function detectProvider(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('dailymotion.com')) return 'Dailymotion';
    if (url.includes('vimeo.com')) return 'Vimeo';
    if (url.includes('fembed') || url.includes('femax')) return 'Fembed';
    if (url.includes('streamtape')) return 'Streamtape';
    if (url.includes('doodstream')) return 'Doodstream';
    return 'External';
}

// Helper: Extract host from URL
function extractHost(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return 'unknown';
    }
}

module.exports = { scrapeEpisode };
