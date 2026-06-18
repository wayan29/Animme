const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText } = require('./helpers');

function isSafeSlug(slug = '') {
    return /^[a-z0-9][a-z0-9_-]{0,220}$/i.test(slug);
}

function isSafeHttpUrl(url = '') {
    if (!url || typeof url !== 'string') return false;
    if (url === '#' || /^javascript:/i.test(url) || /^data:/i.test(url)) return false;
    try {
        const parsed = new URL(url, BASE_URL);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function absoluteUrl(url = '') {
    if (!url) return '';
    try {
        return new URL(url, BASE_URL).href;
    } catch {
        return url;
    }
}

function parseQuality(text = '') {
    const match = text.match(/\[(\d{3,4}p|HD|FHD|SD)\]/i) || text.match(/\b(\d{3,4}p|HD|FHD|SD)\b/i);
    if (!match) return cleanText(text) || 'Download';
    const value = match[1].toUpperCase();
    if (/^\d/.test(value)) return value.toLowerCase();
    return value;
}

function parseInfoParagraph($, element) {
    const $elem = $(element);
    const label = cleanText($elem.find('strong, b').first().text()).replace(/:$/, '').trim();
    const rawText = cleanText($elem.text());

    if (label && rawText.toLowerCase().startsWith(label.toLowerCase())) {
        const value = cleanText(rawText.slice(label.length).replace(/^\s*:\s*/, ''));
        return { label, value };
    }

    const match = rawText.match(/^([^:]{2,50})\s*:\s*(.+)$/);
    if (match) {
        return { label: cleanText(match[1]).replace(/:$/, '').trim(), value: cleanText(match[2]) };
    }

    return { label: '', value: '' };
}

function pushUniqueUrl(items, seen, item) {
    const url = absoluteUrl(item.url || '');
    if (!isSafeHttpUrl(url) || seen.has(url)) return;
    seen.add(url);
    items.push({ ...item, url });
}

// Scrape episode detail (Nekopoi currently uses episode-post pages, not /hentai detail URLs)
async function scrapeEpisode(slug) {
    try {
        if (!isSafeSlug(slug)) {
            return {
                status: 'error',
                message: 'Invalid episode slug'
            };
        }

        const url = `${BASE_URL}/${slug}/`;
        const $ = await fetchPage(url);

        const title = cleanText(
            $('.nk-post-header h1').first().text()
            || $('h1.entry-title, h1.title, .single-title h1, h1').first().text()
            || $('meta[property="og:title"]').attr('content')
        );

        const thumbnail = $('.nk-featured-img img, .nk-post-body img.wp-post-image').first().attr('src')
            || $('.entry-content img, .thumbnail img, article img').first().attr('src')
            || $('.entry-content img, .thumbnail img, article img').first().attr('data-src')
            || $('meta[property="og:image"]').attr('content');

        const videoInfo = {};
        const descriptionParts = [];
        $('.konten p, .entry-content p, .synopsis p, .description p').each((_, elem) => {
            const text = cleanText($(elem).text());
            if (!text) return;

            const { label, value } = parseInfoParagraph($, elem);
            if (label && value) {
                videoInfo[label.toLowerCase().trim()] = value;
            } else {
                descriptionParts.push(text);
            }
        });

        let description = cleanText(descriptionParts.join(' '));
        if (!description) {
            description = cleanText($('meta[property="og:description"]').attr('content') || $('.konten').first().text());
        }

        const streamUrls = [];
        const seenStreams = new Set();
        const streamLabelsById = {};
        $('#nk-player-tabs a[href^="#"]').each((_, elem) => {
            const $link = $(elem);
            const target = String($link.attr('href') || '').replace(/^#/, '');
            const label = cleanText($link.text());
            if (target && label) {
                streamLabelsById[target] = label;
            }
        });

        $('#nk-player .nk-player-frame iframe[src], .nk-player-frame iframe[src], .nk-player-wrapper iframe[src], .video-player iframe[src], .player iframe[src], iframe[src]').each((_, elem) => {
            const src = $(elem).attr('src');
            const frameId = cleanText($(elem).closest('.nk-player-frame').attr('id') || '');
            const label = streamLabelsById[frameId] || frameId || `Server ${streamUrls.length + 1}`;
            pushUniqueUrl(streamUrls, seenStreams, {
                provider: detectProvider(src),
                url: src,
                label,
                quality: label,
                type: 'iframe'
            });
        });

        $('video source, .video-player source').each((_, elem) => {
            const src = $(elem).attr('src');
            const type = $(elem).attr('type');
            pushUniqueUrl(streamUrls, seenStreams, {
                provider: 'Direct',
                url: src,
                type: type || 'video/mp4',
                quality: 'Direct Video'
            });
        });

        const downloadLinks = [];
        const seenDownloadUrls = new Set();

        $('.nk-download-section .nk-download-row, .nk-download-row').each((_, row) => {
            const $row = $(row);
            const qualityText = cleanText($row.find('.nk-download-name').first().text()) || cleanText($row.text());
            const quality = parseQuality(qualityText);

            $row.find('.nk-download-links a[href], a[href]').each((__, link) => {
                const $link = $(link);
                const linkUrl = $link.attr('href');
                if (!isDownloadCandidate(linkUrl)) return;

                pushUniqueUrl(downloadLinks, seenDownloadUrls, {
                    quality,
                    url: linkUrl,
                    host: cleanText($link.text()) || extractHost(linkUrl)
                });
            });
        });

        // Legacy/generic fallback for older pages.
        if (downloadLinks.length === 0) {
            $('a[href]').each((_, elem) => {
                const $elem = $(elem);
                const linkUrl = $elem.attr('href');
                const text = cleanText($elem.text());
                if (!isDownloadCandidate(linkUrl)) return;
                if (!/(download|unduh|360p|480p|720p|1080p|kraken|pixeldrain|mp4upload|mega|drive|mediafire|mirror)/i.test(`${text} ${linkUrl}`)) return;

                pushUniqueUrl(downloadLinks, seenDownloadUrls, {
                    quality: parseQuality(text),
                    url: linkUrl,
                    host: text && !/\d{3,4}p/i.test(text) ? text : extractHost(linkUrl)
                });
            });
        }

        const genres = [];
        $('a[rel="tag"], .genre a, .tags a, .category a').each((_, elem) => {
            const $elem = $(elem);
            const name = cleanText($elem.text());
            if (!name) return;
            genres.push({
                name,
                slug: extractSlugFromUrl($elem.attr('href'))
            });
        });

        if (!genres.length && videoInfo.genre) {
            videoInfo.genre.split(/,|\//).map(cleanText).filter(Boolean).forEach((name) => {
                genres.push({ name, slug: '' });
            });
        }

        const navigation = { prev: null, next: null };
        const prevLink = $('.nk-episode-nav a.nk-episode-prev, .nav-previous a, .prev-episode a, a[rel="prev"]').first();
        if (prevLink.length) {
            navigation.prev = {
                title: cleanText(prevLink.find('span').text() || prevLink.text() || prevLink.attr('title')),
                slug: extractSlugFromUrl(prevLink.attr('href')),
                url: prevLink.attr('href')
            };
        }

        const nextLink = $('.nk-episode-nav a.nk-episode-next, .nav-next a, .next-episode a, a[rel="next"]').first();
        if (nextLink.length) {
            navigation.next = {
                title: cleanText(nextLink.find('span').text() || nextLink.text() || nextLink.attr('title')),
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
                downloadLinks,
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

function isDownloadCandidate(url = '') {
    if (!isSafeHttpUrl(url)) return false;
    const normalized = absoluteUrl(url).toLowerCase();
    if (normalized.includes('iframe') || normalized.includes('/embed')) return false;
    if (/playmogo|streampoi|fembed|femax|streamtape|doodstream/.test(normalized)) return false;
    return true;
}

// Helper: Detect video provider
function detectProvider(url = '') {
    const lower = String(url).toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube';
    if (lower.includes('dailymotion.com')) return 'Dailymotion';
    if (lower.includes('vimeo.com')) return 'Vimeo';
    if (lower.includes('playmogo')) return 'Playmogo';
    if (lower.includes('streampoi')) return 'Streampoi';
    if (lower.includes('fembed') || lower.includes('femax')) return 'Fembed';
    if (lower.includes('streamtape')) return 'Streamtape';
    if (lower.includes('doodstream')) return 'Doodstream';
    return 'External';
}

// Helper: Extract host from URL
function extractHost(url) {
    try {
        const urlObj = new URL(url, BASE_URL);
        return urlObj.hostname.replace(/^www\./, '');
    } catch {
        return 'unknown';
    }
}

module.exports = { scrapeEpisode };
