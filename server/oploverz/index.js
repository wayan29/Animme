const {
    fetchPage,
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
    const html = await fetchPage('/');
    const series = extractAllSeries(html);
    const latest = uniqueBy(series.filter((item) => item.total_episodes || item.status), (item) => item.slug).slice(0, 24);
    const hot = series.filter((item) => item.hot).slice(0, 12);

    return {
        status: 'success',
        data: {
            latest_episodes: latest,
            popular: hot.length ? hot : series.slice(0, 12),
            series: series.slice(0, 24)
        }
    };
}

async function scrapeAnimeList(page = 1) {
    const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
    const html = await fetchPage(safePage > 1 ? `/series?page=${safePage}` : '/series');
    const series = extractAllSeries(html);
    const meta = extractMeta(html);

    return {
        status: 'success',
        data: {
            anime_list: series,
            meta: {
                current_page: Number(meta.currentPage) || safePage,
                last_page: Number(meta.lastPage) || 1,
                per_page: Number(meta.perPage) || series.length,
                total: Number(meta.total) || series.length
            }
        }
    };
}

async function scrapeDetail(slug) {
    const safeSlug = String(slug || '').trim();
    if (!safeSlug) throw new Error('Slug is required');

    const html = await fetchPage(`/series/${encodeURIComponent(safeSlug)}`);
    const seriesRaw = extractLiteral(html, 'series:');
    const series = mapSeries(seriesRaw || { slug: safeSlug });
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

async function scrapeEpisode(slug, episodeNumber) {
    const safeSlug = String(slug || '').trim();
    const safeEpisode = String(episodeNumber || '').trim();
    if (!safeSlug || !/^\d+(?:\.\d+)?$/.test(safeEpisode)) {
        throw new Error('Invalid episode request');
    }

    const html = await fetchPage(`/series/${encodeURIComponent(safeSlug)}/episode/${encodeURIComponent(safeEpisode)}`);
    const episode = extractLiteral(html, 'episode:');
    if (!episode) throw new Error('Episode data not found');

    const series = mapSeries(episode.series || { slug: safeSlug });
    const current = mapEpisode(episode, series);
    const totalEpisodes = Number(series.total_episodes) || null;
    const numericEpisode = Number(current.episode_num);

    return {
        status: 'success',
        data: {
            ...current,
            title: current.title,
            series_title: series.title,
            series_slug: series.slug || safeSlug,
            poster: series.poster,
            description: series.description,
            series,
            streams: mapStreams(episode.streamUrl),
            downloads: mapDownloads(episode.downloadUrl),
            previous_episode: numericEpisode > 1 ? String(numericEpisode - 1) : null,
            next_episode: totalEpisodes && numericEpisode < totalEpisodes ? String(numericEpisode + 1) : null
        }
    };
}

async function scrapeSearch(query, page = 1) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return { status: 'success', data: { query: '', anime_list: [], meta: { current_page: 1, last_page: 1 } } };

    const list = await scrapeAnimeList(page);
    const filtered = list.data.anime_list.filter((item) => [
        item.title,
        item.japanese_title,
        item.description,
        ...(item.genres || []).map((genre) => genre.name)
    ].join(' ').toLowerCase().includes(q));

    return {
        status: 'success',
        data: {
            query,
            anime_list: filtered,
            meta: list.data.meta,
            limited: true
        }
    };
}

module.exports = {
    scrapeHome,
    scrapeAnimeList,
    scrapeDetail,
    scrapeAnimeDetail: scrapeDetail,
    scrapeEpisode,
    scrapeSearch
};
