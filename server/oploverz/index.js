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
    uniqueBy
} = require('./helpers');

function sortEpisodes(episodes) {
    return [...episodes].sort((a, b) => Number(a.episode_num) - Number(b.episode_num));
}

async function scrapeHome() {
    const [episodesPayload, seriesPayload] = await Promise.all([
        fetchApi('/api/episodes', { page: 1 }),
        fetchApi('/api/series', { page: 1 })
    ]);

    const latestEpisodes = Array.isArray(episodesPayload.data)
        ? episodesPayload.data.map((episode) => ({
            ...mapEpisode(episode, episode.series || {}),
            series_title: episode.series?.title || '',
            poster: episode.series?.poster || '',
            detail_slug: episode.series?.slug || ''
        }))
        : [];
    const series = Array.isArray(seriesPayload.data) ? seriesPayload.data.map(mapSeries) : [];
    const hot = series.filter((item) => item.hot).slice(0, 12);

    return {
        status: 'success',
        data: {
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

function buildSeriesParams(page = 1, filters = {}) {
    const params = { page };
    if (filters.q) params.q = String(filters.q).trim().slice(0, 80);
    ['hot', 'mature', 'censored'].forEach((key) => {
        if (['true', 'false'].includes(String(filters[key]).toLowerCase())) {
            params[key] = String(filters[key]).toLowerCase();
        }
    });
    if (/^[a-z0-9-]{2,80}$/i.test(String(filters.season || ''))) {
        params.season = String(filters.season).toLowerCase();
    }
    return params;
}

async function scrapeAnimeList(page = 1, filters = {}) {
    const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
    const payload = await fetchApi('/api/series', buildSeriesParams(safePage, filters));
    const series = Array.isArray(payload.data) ? payload.data.map(mapSeries) : [];

    return {
        status: 'success',
        data: {
            anime_list: series,
            meta: normalizeMeta(payload.meta, safePage, series.length)
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

async function scrapeSearch(query, page = 1, filters = {}) {
    const q = String(query || '').trim();
    const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
    if (!q) return { status: 'success', data: { query: '', anime_list: [], meta: { current_page: 1, last_page: 1 } } };

    const payload = await fetchApi('/api/series', buildSeriesParams(safePage, { ...filters, q }));
    const series = Array.isArray(payload.data) ? payload.data.map(mapSeries) : [];

    return {
        status: 'success',
        data: {
            query,
            anime_list: series,
            meta: normalizeMeta(payload.meta, safePage, series.length),
            limited: false
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
    scrapeSearch
};
