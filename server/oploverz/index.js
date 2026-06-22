const cheerio = require('cheerio');

const {
    fetchPage,
    fetchApi,
    extractLiteral,
    extractAllSeries,
    extractMeta,
    mapSeries,
    mapEpisode,
    mapStreams,
    mapDownloads,
    proxyImageUrl,
    getImageUrlMap,
    uniqueBy
} = require('./helpers');

function sortEpisodes(episodes) {
    return [...episodes].sort((a, b) => Number(a.episode_num) - Number(b.episode_num));
}

function extractBannersFromHome(html) {
    const $ = cheerio.load(html);
    const banners = [];

    $('[data-embla-slide]').each((_, slide) => {
        const $slide = $(slide);
        const image = $slide.find('img').first().attr('src') || '';
        const title = $slide.find('h1 span').first().text().trim() || $slide.find('img').first().attr('alt') || '';
        const description = $slide.find('p').filter((__, p) => $(p).text().trim().length > 40).first().text().trim();
        const detailPath = $slide.find('a[href^="/series/"]').first().attr('href') || '';
        const watchPath = $slide.find('a[href*="/episode/"]').first().attr('href') || '';
        const slugMatch = detailPath.match(/^\/series\/([^/]+)/);

        if (image && title && slugMatch) {
            banners.push({
                title,
                slug: slugMatch[1],
                description,
                banner: proxyImageUrl(image),
                detail_url: `/v11/detail?slug=${encodeURIComponent(slugMatch[1])}`,
                watch_url: watchPath.replace(/^\/series\/([^/]+)\/episode\/([^/]+).*$/, (_match, slug, episode) => `/v11/episode?slug=${encodeURIComponent(slug)}&episode=${encodeURIComponent(episode)}`)
            });
        }
    });

    return uniqueBy(banners, (banner) => banner.slug).slice(0, 8);
}

async function scrapeHome() {
    const [episodesPayload, seriesPayload, homeHtml] = await Promise.all([
        fetchApi('/api/episodes', { page: 1 }),
        fetchApi('/api/series', { page: 1 }),
        fetchPage('/')
    ]);

    const latestEpisodes = Array.isArray(episodesPayload.data)
        ? episodesPayload.data.map((episode) => ({
            ...mapEpisode(episode, episode.series || {}),
            series_title: episode.series?.title || '',
            poster: proxyImageUrl(episode.series?.poster || ''),
            detail_slug: episode.series?.slug || ''
        }))
        : [];
    const series = Array.isArray(seriesPayload.data) ? seriesPayload.data.map(mapSeries) : [];
    const hot = series.filter((item) => item.hot).slice(0, 12);

    const banners = extractBannersFromHome(homeHtml);

    return {
        status: 'success',
        data: {
            banners,
            latest_episodes: latestEpisodes,
            popular: hot.length ? hot : series.slice(0, 12),
            series: series.slice(0, 24),
            meta: {
                episodes: normalizeMeta(episodesPayload.meta, 1, latestEpisodes.length),
                series: normalizeMeta(seriesPayload.meta, 1, series.length)
            }
        }
    };
}

function normalizeMeta(meta = {}, fallbackPage = 1, fallbackTotal = 0) {
    return {
        current_page: Number(meta.currentPage) || fallbackPage,
        first_page: Number(meta.firstPage) || 1,
        last_page: Number(meta.lastPage) || 1,
        per_page: Number(meta.perPage) || 10,
        total: Number(meta.total) || fallbackTotal
    };
}

function cleanCsv(value, pattern = /^[a-z0-9-]{1,80}$/i, maxItems = 12) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => pattern.test(item))
        .slice(0, maxItems)
        .join(',');
}

function buildSeriesParams(page = 1, filters = {}) {
    const params = { page };
    if (filters.q) params.q = String(filters.q).trim().slice(0, 80);
    ['hot', 'mature', 'censored'].forEach((key) => {
        if (['true', 'false'].includes(String(filters[key]).toLowerCase())) {
            params[key] = String(filters[key]).toLowerCase();
        }
    });
    const genres = cleanCsv(filters.genres || filters.genre);
    if (genres) params.genres = genres;
    const sortBy = String(filters.sortBy || filters.sort_by || '').trim();
    if (/^(default|releaseDate|createdAt|title)-(asc|desc)$/i.test(sortBy)) {
        params.sortBy = sortBy;
    }
    if (/^[a-z0-9-]{2,80}$/i.test(String(filters.season || ''))) {
        params.season = String(filters.season).toLowerCase();
    }
    const pageSize = Math.max(1, Math.min(Number(filters.pageSize || filters.page_size) || 10, 50));
    if (pageSize !== 10) params.pageSize = pageSize;
    return params;
}

async function scrapeAnimeList(page = 1, filters = {}) {
    const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
    const payload = await fetchApi('/api/series', buildSeriesParams(safePage, filters));
    let series = Array.isArray(payload.data) ? payload.data.map(mapSeries) : [];
    const types = cleanCsv(filters.type, /^[A-Za-z0-9 -]{1,80}$/, 12).split(',').filter(Boolean);
    if (types.length) {
        series = series.filter((item) => types.includes(item.type));
    }

    return {
        status: 'success',
        data: {
            anime_list: series,
            meta: normalizeMeta(payload.meta, safePage, series.length),
            filters: {
                ...buildSeriesParams(safePage, filters),
                ...(types.length ? { type: types.join(',') } : {})
            },
            type_filter_limited: Boolean(types.length)
        }
    };
}

async function scrapeDetail(slug) {
    const safeSlug = String(slug || '').trim();
    if (!safeSlug) throw new Error('Slug is required');

    const payload = await fetchApi(`/api/series/${encodeURIComponent(safeSlug)}`);
    const series = mapSeries(payload.data || { slug: safeSlug });
    const html = await fetchPage(`/series/${encodeURIComponent(safeSlug)}`);
    let episodes = [];

    try {
        const rawEpisodes = extractLiteral(html, 'episodes:');
        if (Array.isArray(rawEpisodes)) {
            episodes = rawEpisodes.map((episode) => mapEpisode(episode, series));
        }
    } catch (error) {}

    episodes = uniqueBy(episodes, (item) => item.episode_num).filter((item) => item.episode_num);

    return {
        status: 'success',
        data: {
            ...series,
            episodes: sortEpisodes(episodes)
        }
    };
}

async function findLatestEpisodeBySlugAndNumber(slug, episodeNumber, maxPages = 5) {
    for (let page = 1; page <= maxPages; page++) {
        const payload = await fetchApi('/api/episodes', { page });
        const match = Array.isArray(payload.data)
            ? payload.data.find((episode) => episode.series?.slug === slug && String(episode.episodeNumber) === String(episodeNumber))
            : null;
        if (match) return match;
        const lastPage = Number(payload.meta?.lastPage) || 1;
        if (page >= lastPage) break;
    }
    return null;
}

function buildEpisodeResponse(episode, fallbackSlug = '', source = 'api') {
    if (!episode) throw new Error('Episode data not found');

    const series = mapSeries(episode.series || { slug: fallbackSlug });
    const current = mapEpisode(episode, series);
    const totalEpisodes = Number(series.total_episodes) || null;
    const numericEpisode = Number(current.episode_num);

    return {
        status: 'success',
        data: {
            ...current,
            title: current.title,
            series_title: series.title,
            series_slug: series.slug || fallbackSlug,
            poster: series.poster,
            description: series.description,
            series,
            streams: mapStreams(episode.streamUrl),
            downloads: mapDownloads(episode.downloadUrl),
            previous_episode: numericEpisode > 1 ? String(numericEpisode - 1) : null,
            next_episode: totalEpisodes && numericEpisode < totalEpisodes ? String(numericEpisode + 1) : null,
            source
        }
    };
}

async function scrapeEpisodeById(id) {
    const safeId = String(id || '').trim();
    if (!/^\d{1,20}$/.test(safeId)) {
        throw new Error('Invalid episode id');
    }

    const payload = await fetchApi(`/api/episodes/${safeId}`);
    return buildEpisodeResponse(payload.data, payload.data?.series?.slug || '', 'api-id');
}

async function scrapeEpisode(slug, episodeNumber) {
    const safeSlug = String(slug || '').trim();
    const safeEpisode = String(episodeNumber || '').trim();
    if (!safeSlug || !/^\d+(?:\.\d+)?$/.test(safeEpisode)) {
        throw new Error('Invalid episode request');
    }

    let episode = await findLatestEpisodeBySlugAndNumber(safeSlug, safeEpisode);
    let source = 'api';

    if (!episode) {
        const html = await fetchPage(`/series/${encodeURIComponent(safeSlug)}/episode/${encodeURIComponent(safeEpisode)}`);
        episode = extractLiteral(html, 'episode:');
        source = 'ssr';
    }

    return buildEpisodeResponse(episode, safeSlug, source);
}

async function scrapeGenres(page = 1) {
    const safePage = Math.max(1, Math.min(Number(page) || 1, 20));
    const payload = await fetchApi('/api/genres', { page: safePage, pageSize: 100 });
    return {
        status: 'success',
        data: {
            genres: Array.isArray(payload.data) ? payload.data.map((genre) => ({
                id: genre.id,
                name: genre.name || '',
                slug: genre.slug || ''
            })) : [],
            meta: normalizeMeta(payload.meta, safePage, 0)
        }
    };
}

function getFilterConfig() {
    return {
        status: 'success',
        data: {
            sort_options: [
                { value: 'default', label: 'Default' },
                { value: 'releaseDate-asc', label: 'Tanggal Rilis (Terlama)' },
                { value: 'releaseDate-desc', label: 'Tanggal Rilis (Terbaru)' },
                { value: 'createdAt-asc', label: 'Dibuat (Terlama)' },
                { value: 'createdAt-desc', label: 'Dibuat (Terbaru)' },
                { value: 'title-asc', label: 'Judul (A-Z)' },
                { value: 'title-desc', label: 'Judul (Z-A)' }
            ],
            type_options: ['BD', 'Movie', 'ONA', 'OVA', 'Special', 'TV']
        }
    };
}

async function scrapeSearch(query, page = 1, filters = {}) {
    const q = String(query || '').trim();
    const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
    if (!q) return { status: 'success', data: { query: '', anime_list: [], meta: { current_page: 1, last_page: 1 } } };

    const payload = await fetchApi('/api/series', buildSeriesParams(safePage, { ...filters, q }));
    let series = Array.isArray(payload.data) ? payload.data.map(mapSeries) : [];
    const types = cleanCsv(filters.type, /^[A-Za-z0-9 -]{1,80}$/, 12).split(',').filter(Boolean);
    if (types.length) {
        series = series.filter((item) => types.includes(item.type));
    }

    return {
        status: 'success',
        data: {
            query,
            anime_list: series,
            meta: normalizeMeta(payload.meta, safePage, series.length),
            filters: {
                ...buildSeriesParams(safePage, { ...filters, q }),
                ...(types.length ? { type: types.join(',') } : {})
            },
            limited: false,
            type_filter_limited: Boolean(types.length)
        }
    };
}

module.exports = {
    scrapeHome,
    scrapeAnimeList,
    scrapeDetail,
    scrapeAnimeDetail: scrapeDetail,
    scrapeEpisode,
    scrapeEpisodeById,
    scrapeSearch,
    scrapeGenres,
    getFilterConfig,
    getImageUrlMap
};
