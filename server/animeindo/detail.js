// AnimeIndo Detail Scraper
const {
    BASE_URL,
    fetchPage,
    cleanText,
    extractSlugFromUrl,
    imageProxy,
    toAbsoluteUrl
} = require('./helpers');

function buildDetailUrl(slugOrUrl = '') {
    if (!slugOrUrl) return BASE_URL;

    const trimmed = slugOrUrl.trim();

    if (trimmed.startsWith('http')) {
        return trimmed;
    }

    let path = trimmed.replace(/^\/+/g, '').replace(/\/+$/g, '');
    if (!path.startsWith('anime/')) {
        path = `anime/${path}`;
    }
    return `${BASE_URL}/${path}`.replace(/\/+$/, '') + '/';
}

function parseGenres($) {
    const genres = [];
    $('.detail li a').each((_, el) => {
        const name = cleanText($(el).text());
        const href = $(el).attr('href');
        if (!name) return;
        genres.push({
            name,
            url: toAbsoluteUrl(href),
            slug: extractSlugFromUrl(href)
        });
    });
    return genres;
}

function parseEpisodeList($) {
    const episodes = [];
    $('.menu .ep a').each((_, el) => {
        const $el = $(el);
        const label = cleanText($el.text());
        const href = $el.attr('href');
        if (!href) return;

        const episodeNumber = label || null;

        episodes.push({
            episode: episodeNumber,
            url: toAbsoluteUrl(href),
            slug: extractSlugFromUrl(href)
        });
    });
    return episodes;
}

async function scrapeAnimeDetail(slugOrUrl) {
    const targetUrl = buildDetailUrl(slugOrUrl);
    const $ = await fetchPage(targetUrl);

    const title = cleanText($('h1.title').first().text());
    const posterSrc = $('.detail img').first().attr('src');
    const synopsis = cleanText($('.detail p').first().text());
    const genres = parseGenres($);
    const episodes = parseEpisodeList($);

    return {
        status: 'success',
        data: {
            title,
            synopsis,
            poster: imageProxy(posterSrc),
            poster_original: toAbsoluteUrl(posterSrc),
            genres,
            total_episodes: episodes.length,
            episodes,
            url: targetUrl,
            slug: extractSlugFromUrl(targetUrl)
        }
    };
}

module.exports = {
    scrapeAnimeDetail
};
