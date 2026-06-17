// AnimeIndo Episode Scraper
const {
    BASE_URL,
    fetchPage,
    cleanText,
    extractSlugFromUrl,
    imageProxy,
    toAbsoluteUrl
} = require('./helpers');

function buildEpisodeUrl(slugOrUrl = '') {
    if (!slugOrUrl) return BASE_URL;

    const trimmed = slugOrUrl.trim();
    if (trimmed.startsWith('http')) {
        return trimmed;
    }

    const path = trimmed.replace(/^\/+/g, '').replace(/\/+$/g, '');
    return `${BASE_URL}/${path}`.replace(/\/+$/, '') + '/';
}

function parseServers($, defaultEmbedUrl) {
    const servers = [];

    $('.servers a.server').each((_, el) => {
        const $el = $(el);
        const name = cleanText($el.text()) || 'Unknown';
        const embedUrl = $el.attr('data-video') || $el.attr('data-src') || defaultEmbedUrl;

        servers.push({
            name,
            embed_url: toAbsoluteUrl(embedUrl),
            is_active: $el.hasClass('cur')
        });
    });

    if (!servers.length && defaultEmbedUrl) {
        servers.push({
            name: 'Default',
            embed_url: toAbsoluteUrl(defaultEmbedUrl),
            is_active: true
        });
    }

    return servers;
}

function parseNavigation($) {
    const nav = {
        previous: null,
        next: null,
        all_episodes: null
    };

    $('.nav .navi a').each((_, el) => {
        const $el = $(el);
        const text = cleanText($el.text()).toLowerCase();
        const href = $el.attr('href');
        if (!href) return;

        if (text.includes('prev')) {
            nav.previous = toAbsoluteUrl(href);
        } else if (text.includes('next')) {
            nav.next = toAbsoluteUrl(href);
        } else if (text.includes('semua episode') || text.includes('all episode')) {
            nav.all_episodes = toAbsoluteUrl(href);
        }
    });

    return nav;
}

function parseDownloadLinks($) {
    const downloads = [];

    $('.nav .navi a').each((_, el) => {
        const $el = $(el);
        const text = cleanText($el.text());
        const href = $el.attr('href');

        if (!href || !/download/i.test(text)) return;

        downloads.push({
            name: text,
            url: toAbsoluteUrl(href)
        });
    });

    return downloads;
}

async function scrapeEpisode(slugOrUrl) {
    const targetUrl = buildEpisodeUrl(slugOrUrl);
    const $ = await fetchPage(targetUrl);

    const title = cleanText($('h1.title').first().text());
    const defaultIframeSrc = $('#tontonin').attr('src') || $('iframe').first().attr('src');
    const posterSrc = $('.detail img').first().attr('src');
    const synopsis = cleanText($('.detail p').first().text());
    const servers = parseServers($, defaultIframeSrc);
    const navigation = parseNavigation($);
    const downloads = parseDownloadLinks($);

    const episodeSlug = extractSlugFromUrl(targetUrl);
    let animeSlug = null;
    if (navigation.all_episodes) {
        animeSlug = extractSlugFromUrl(navigation.all_episodes);
    }

    return {
        status: 'success',
        data: {
            title,
            synopsis,
            poster: imageProxy(posterSrc),
            poster_original: toAbsoluteUrl(posterSrc),
            default_embed: toAbsoluteUrl(defaultIframeSrc),
            servers,
            navigation,
            downloads,
            url: targetUrl,
            slug: episodeSlug,
            anime_slug: animeSlug
        }
    };
}

module.exports = {
    scrapeEpisode
};
