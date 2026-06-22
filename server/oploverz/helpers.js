const axios = require('axios');
const vm = require('vm');

const BASE_URL = 'https://plus.oploverz.ltd';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    Referer: `${BASE_URL}/`
};

function normalizePath(pathOrUrl = '/') {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return `${BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

async function fetchPage(pathOrUrl) {
    const url = normalizePath(pathOrUrl);
    const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 30000,
        maxRedirects: 3,
        responseType: 'text',
        validateStatus: (status) => status >= 200 && status < 400
    });
    return response.data;
}

function findLiteralStart(source, marker, fromIndex = 0) {
    const markerIndex = source.indexOf(marker, fromIndex);
    if (markerIndex === -1) return -1;
    const valueIndex = markerIndex + marker.length;
    for (let i = valueIndex; i < source.length; i++) {
        if (source[i] === '{' || source[i] === '[') return i;
        if (!/\s|:/.test(source[i])) return -1;
    }
    return -1;
}

function extractBalancedLiteral(source, marker, fromIndex = 0) {
    const start = findLiteralStart(source, marker, fromIndex);
    if (start === -1) return null;

    const opener = source[start];
    const closer = opener === '{' ? '}' : ']';
    const stack = [closer];
    let quote = null;
    let escaped = false;

    for (let i = start + 1; i < source.length; i++) {
        const char = source[i];

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }

        if (char === '{') stack.push('}');
        else if (char === '[') stack.push(']');
        else if (char === stack[stack.length - 1]) {
            stack.pop();
            if (!stack.length) return source.slice(start, i + 1);
        }
    }

    return null;
}

function evalLiteral(literal) {
    if (!literal) return null;
    return vm.runInNewContext(`(${literal})`, Object.freeze({}), { timeout: 1000 });
}

function extractLiteral(source, marker, fromIndex = 0) {
    return evalLiteral(extractBalancedLiteral(source, marker, fromIndex));
}

function uniqueBy(items, keyFn) {
    const seen = new Set();
    return items.filter((item) => {
        const key = keyFn(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function mapGenre(genre) {
    if (!genre) return null;
    return {
        name: genre.name || '',
        slug: genre.slug || ''
    };
}

function mapSeries(item = {}) {
    const slug = item.slug || '';
    return {
        title: item.title || '',
        japanese_title: item.japaneseTitle || '',
        slug,
        poster: item.poster || item.image || '',
        description: item.description || '',
        status: item.status || '',
        type: item.releaseType || '',
        score: item.score || null,
        duration: item.duration || '',
        release_date: item.releaseDate || '',
        genres: Array.isArray(item.genres) ? item.genres.map(mapGenre).filter(Boolean) : [],
        studio: item.studio?.name || '',
        season: item.season?.name || '',
        total_episodes: item.totalEpisodes || null,
        hot: Boolean(item.hot),
        mature: Boolean(item.mature),
        censored: Boolean(item.censored),
        url: slug ? `${BASE_URL}/series/${slug}` : ''
    };
}

function mapEpisode(item = {}, series = {}) {
    const seriesSlug = series.slug || item.series?.slug || '';
    const episodeNum = String(item.episodeNumber || item.episode_num || '').trim();
    return {
        title: item.title || `${series.title || seriesSlug || 'Episode'} ${episodeNum}`.trim(),
        episode_num: episodeNum,
        slug: seriesSlug && episodeNum ? `${seriesSlug}/episode/${episodeNum}` : '',
        series_slug: seriesSlug,
        url: seriesSlug && episodeNum ? `${BASE_URL}/series/${seriesSlug}/episode/${episodeNum}` : '',
        released_at: item.releasedAt || '',
        subbed: item.subbed || ''
    };
}

function mapStreams(streamUrl = []) {
    if (!Array.isArray(streamUrl)) return [];
    return streamUrl.map((stream) => {
        const source = stream.source || 'Server';
        const qualityMatch = source.match(/(\d{3,4}p)/i);
        let server = 'Embed';
        try {
            const host = new URL(stream.url).hostname.replace(/^www\./, '');
            server = host.includes('dailymotion') ? 'Dailymotion' : host;
        } catch (error) {}
        return {
            source,
            server,
            quality: qualityMatch ? qualityMatch[1].toLowerCase() : '',
            url: stream.url || ''
        };
    }).filter((stream) => stream.url);
}

function mapDownloads(downloadUrl = []) {
    if (!Array.isArray(downloadUrl)) return [];
    return downloadUrl.flatMap((group) => (group.resolutions || []).map((resolution) => ({
        format: group.format || '',
        quality: resolution.quality || '',
        links: Array.isArray(resolution.download_links) ? resolution.download_links.map((link) => ({
            host: link.host || '',
            url: link.url || ''
        })).filter((link) => link.url) : []
    }))).filter((item) => item.links.length);
}

function extractAllSeries(html) {
    const results = [];
    let from = 0;
    while (results.length < 120) {
        const idx = html.indexOf('series:{', from);
        if (idx === -1) break;
        try {
            const series = extractLiteral(html, 'series:', idx);
            if (series?.slug && series?.title) results.push(series);
        } catch (error) {}
        from = idx + 8;
    }

    from = 0;
    while (results.length < 120) {
        const idx = html.indexOf('series:[', from);
        if (idx === -1) break;
        try {
            const list = extractLiteral(html, 'series:', idx);
            if (Array.isArray(list)) results.push(...list.filter((item) => item?.slug && item?.title));
        } catch (error) {}
        from = idx + 8;
    }

    from = 0;
    while (results.length < 120) {
        const idx = html.indexOf('series:{data:[', from);
        if (idx === -1) break;
        try {
            const payload = extractLiteral(html, 'series:', idx);
            if (Array.isArray(payload?.data)) {
                results.push(...payload.data.filter((item) => item?.slug && item?.title));
            }
        } catch (error) {}
        from = idx + 8;
    }

    return uniqueBy(results.map(mapSeries), (item) => item.slug);
}

function extractMeta(html) {
    try {
        return extractLiteral(html, 'meta:') || {};
    } catch (error) {
        return {};
    }
}

module.exports = {
    BASE_URL,
    fetchPage,
    extractLiteral,
    extractAllSeries,
    extractMeta,
    mapSeries,
    mapEpisode,
    mapStreams,
    mapDownloads,
    uniqueBy
};
