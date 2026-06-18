const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText } = require('./helpers');

function isSafeSlug(slug = '') {
    return /^[a-z0-9][a-z0-9_-]{0,220}$/i.test(slug);
}

function extractBackgroundImage(style = '') {
    if (!style) return null;
    const match = style.match(/url\((['"]?)(.*?)\1\)/i);
    return match ? match[2] : null;
}

function cleanSeriesTitle(text = '') {
    return cleanText(text)
        .replace(/^Unduh\s+["“”]?/i, '')
        .replace(/["“”]?\s+Indonesian\s+Subbed\/Dubbed\s+Online$/i, '')
        .replace(/["“”]/g, '')
        .trim();
}

function parseInfoItem($, element) {
    const $elem = $(element);
    const label = cleanText($elem.find('b, strong').first().text()).replace(/:$/, '').trim();
    const text = cleanText($elem.text());
    if (!label) {
        const match = text.match(/^([^:]{2,50})\s*:\s*(.+)$/);
        return match ? { label: cleanText(match[1]), value: cleanText(match[2]) } : { label: '', value: '' };
    }

    const value = cleanText(text.slice(label.length).replace(/^\s*:\s*/, ''));
    return { label, value };
}

function pushEpisode(episodes, seenUrls, item) {
    if (!item.title || !item.url || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    episodes.push({
        title: item.title,
        slug: extractSlugFromUrl(item.url),
        url: item.url,
        releaseDate: item.releaseDate || ''
    });
}

// Scrape anime detail (series page)
async function scrapeAnimeDetail(slug) {
    try {
        if (!isSafeSlug(slug)) {
            return {
                status: 'error',
                message: 'Invalid detail slug',
                data: null
            };
        }

        const url = `${BASE_URL}/hentai/${slug}/`;
        const $ = await fetchPage(url);

        let title = cleanSeriesTitle($('.nk-series-info h2').first().text())
            || cleanSeriesTitle($('meta[property="og:title"]').attr('content'))
            || cleanSeriesTitle($('.animeinfos h2').first().text())
            || cleanText($('h1').first().text());

        const poster = extractBackgroundImage($('.nk-series-poster').first().attr('style'))
            || $('meta[property="og:image"]').attr('content')
            || $('.imgdesc img').first().attr('src');

        const synopsis = cleanText($('.nk-series-synopsis > p').first().text())
            || cleanText($('meta[property="og:description"]').attr('content'))
            || cleanText($('.imgdesc .desc p').first().text());

        const latestLink = $('.nk-latest-episode .latestnow a[href], .latestest .latestnow a[href]').first();
        const latestEpisode = {
            episode: cleanText($('.nk-latest-episode .latestepisode, .latestest .latestepisode').first().text()),
            url: latestLink.attr('href') || ''
        };

        const info = {};
        $('.nk-series-meta-list ul li, .listinfo ul li').each((_, elem) => {
            const { label, value } = parseInfoItem($, elem);
            if (!label || !value) return;
            if (label.toLowerCase().includes('genre')) return;
            info[label] = value;
        });

        const genres = [];
        $('.nk-series-meta-list a[rel="tag"], .listinfo a[rel="tag"]').each((_, elem) => {
            const $elem = $(elem);
            const name = cleanText($elem.text());
            const href = $elem.attr('href');
            if (!name) return;
            genres.push({
                name,
                slug: extractSlugFromUrl(href),
                url: href
            });
        });

        const episodes = [];
        const seenUrls = new Set();

        $('.nk-episode-grid a.nk-episode-card[href], a.nk-episode-card[href]').each((_, elem) => {
            const $elem = $(elem);
            const href = $elem.attr('href');
            const titleText = cleanText($elem.find('.nk-episode-card-title').text() || $elem.text());
            const releaseDate = cleanText($elem.find('.nk-episode-card-date').text());
            pushEpisode(episodes, seenUrls, {
                title: titleText,
                url: href,
                releaseDate
            });
        });

        // Legacy fallback for old Nekopoi episode list markup.
        if (episodes.length === 0) {
            $('.episodelist ul li').each((_, elem) => {
                const $elem = $(elem);
                const episodeTitle = cleanText($elem.find('.leftoff a').text());
                const episodeUrl = $elem.find('.leftoff a').attr('href');
                const releaseDate = cleanText($elem.find('.rightoff').text());
                pushEpisode(episodes, seenUrls, {
                    title: episodeTitle,
                    url: episodeUrl,
                    releaseDate
                });
            });
        }

        // Scoped fallback for series pages if card class changes.
        if (episodes.length === 0) {
            $('.nk-series-info a[href], .nk-series-detail a[href]').each((_, elem) => {
                const $elem = $(elem);
                const href = $elem.attr('href');
                const text = cleanText($elem.text());
                if (!href || href.includes('/hentai/')) return;
                if (!/episode|subtitle-indonesia/i.test(`${href} ${text}`)) return;
                pushEpisode(episodes, seenUrls, {
                    title: text || extractSlugFromUrl(href),
                    url: href,
                    releaseDate: ''
                });
            });
        }

        if (!title && episodes.length > 0) {
            title = cleanSeriesTitle(episodes[0].title.replace(/\s+Episode\s+\d+.*$/i, ''));
        }

        return {
            status: 'success',
            data: {
                title,
                slug,
                poster: imageProxy(poster),
                synopsis,
                info,
                genres,
                latestEpisode,
                episodes,
                totalEpisodes: episodes.length
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message,
            data: null
        };
    }
}

module.exports = { scrapeAnimeDetail };
