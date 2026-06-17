const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug, cleanText } = require('./helpers');

const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const ANIME_LIST_CATEGORY_CONFIG = {
    all: {
        path: '/list-anime-batch-sub-indo/',
        mode: 'list',
        title: 'List Anime Batch Subtitle Indonesia'
    },
    bd: {
        path: '/anime-list-bd/',
        mode: 'list',
        title: 'Anime List BD'
    },
    movie: {
        path: '/anime-movie-list/',
        mode: 'list',
        title: 'Movie List'
    },
    'live-action': {
        path: '/daftar-live-action/',
        mode: 'list',
        title: 'Daftar Live Action'
    },
    ova: {
        path: '/seasons/ova/',
        mode: 'grid',
        title: 'Anime OVA'
    },
    special: {
        path: '/seasons/special/',
        mode: 'grid',
        title: 'Anime Special'
    },
    ona: {
        path: '/seasons/ona/',
        mode: 'grid',
        title: 'Anime ONA'
    }
};

function buildUrl(basePath, page = 1) {
    if (page > 1) {
        return `${BASE_URL}${basePath}page/${page}/`;
    }

    return `${BASE_URL}${basePath}`;
}

function extractPageNumber(url) {
    if (!url) {
        return null;
    }

    const match = url.match(/\/page\/(\d+)\/?/);
    return match ? parseInt(match[1], 10) : 1;
}

function parsePagination($, currentPage) {
    const $pagination = $('.wp-pagenavi').first();
    const pagesText = cleanText($pagination.find('.pages').text());
    const lastPageMatch = pagesText.match(/Page\s+\d+\s+of\s+(\d+)/i);
    const lastPage = lastPageMatch ? parseInt(lastPageMatch[1], 10) : currentPage;
    const nextPage = extractPageNumber($pagination.find('.nextpostslink').attr('href'));
    const previousPage = extractPageNumber($pagination.find('.previouspostslink').attr('href'));

    return {
        current_page: currentPage,
        last_page: lastPage,
        has_next_page: Boolean(nextPage && nextPage > currentPage),
        has_previous_page: currentPage > 1,
        next_page: nextPage && nextPage > currentPage ? nextPage : null,
        previous_page: currentPage > 1 ? (previousPage || currentPage - 1) : null
    };
}

function parseKoverEntries($) {
    const items = [];

    $('.kover').each((_, el) => {
        const $el = $(el);
        const $detpost = $el.find('.detpost');
        const $titleLink = $detpost.find('h2.episodeye a').first();
        const title = cleanText($titleLink.text());
        const href = $titleLink.attr('href');
        const $img = $detpost.find('.thumb img').first();
        const poster = $img.attr('src') || $img.attr('data-src');

        const genres = [];
        $detpost.find('.fa-tag').parent().find('a[rel="tag"]').each((__, genreEl) => {
            const genre = cleanText($(genreEl).text());
            if (genre) {
                genres.push(genre);
            }
        });

        let releaseDate = '';
        const $dateP = $detpost.find('.fa-clock-o').parent();
        if ($dateP.length > 0) {
            releaseDate = cleanText($dateP.text().replace('Released on', '').replace(/[^0-9:apm ]+/gi, ''));
        }

        const $authorP = $detpost.find('.fa-user').parent();
        const author = $authorP.length > 0 ? cleanText($authorP.text().replace('Posted by', '')) : '';

        if (title && href) {
            items.push({
                title,
                slug: extractSlug(href),
                poster: proxyImageUrl(poster),
                genres,
                release_date: releaseDate || 'Unknown',
                author,
                url: href
            });
        }
    });

    return items;
}

async function fetchDocument(url) {
    const { data } = await axios.get(url, {
        headers: REQUEST_HEADERS,
        timeout: 30000
    });

    return cheerio.load(data);
}

async function scrapeAnimeList(page = 1, kind = 'all') {
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const normalizedKind = ANIME_LIST_CATEGORY_CONFIG[kind] ? kind : 'all';
    const config = ANIME_LIST_CATEGORY_CONFIG[normalizedKind];
    const $ = await fetchDocument(buildUrl(config.path, currentPage));
    const animeList = [];

    if (config.mode === 'list') {
        $('.jdlbar a.kmz').each((_, el) => {
            const $link = $(el);
            const title = cleanText($link.text());
            const href = $link.attr('href');

            if (title && href) {
                animeList.push({
                    title,
                    slug: extractSlug(href),
                    url: href
                });
            }
        });
    }

    const latestReleases = config.mode === 'grid' ? parseKoverEntries($) : [];

    return {
        status: 'success',
        data: {
            title: cleanText($('.jdlr h1').first().text()) || config.title,
            kind: normalizedKind,
            mode: config.mode,
            anime_list: animeList,
            latest_releases: latestReleases,
            pagination: parsePagination($, currentPage)
        }
    };
}

async function scrapeGenres() {
    const $ = await fetchDocument(`${BASE_URL}/genres/`);
    const seen = new Set();
    const genres = [];

    $('.genres a[href*="/genres/"]').each((_, el) => {
        const $link = $(el);
        const name = cleanText($link.text());
        const href = $link.attr('href');
        const slug = extractSlug(href);

        if (!name || !href || !slug || seen.has(slug)) {
            return;
        }

        seen.add(slug);
        genres.push({ name, slug, url: href });
    });

    genres.sort((a, b) => a.name.localeCompare(b.name));

    return {
        status: 'success',
        data: {
            title: cleanText($('.jdlr h1').first().text()) || 'Genres',
            genres
        }
    };
}

async function scrapeSeasons() {
    const $ = await fetchDocument(`${BASE_URL}/seasons-list/`);
    const seasons = [];
    const seen = new Set();
    const seasonOrder = { winter: 0, spring: 1, summer: 2, fall: 3 };

    $('.genres a[href*="/seasons/"]').each((_, el) => {
        const $link = $(el);
        const name = cleanText($link.text());
        const href = $link.attr('href');
        const slug = extractSlug(href);
        const match = slug.match(/^(winter|spring|summer|fall)-(\d{4})$/i);

        if (!match || seen.has(slug)) {
            return;
        }

        seen.add(slug);
        seasons.push({
            name,
            slug,
            url: href,
            season: match[1].toLowerCase(),
            year: parseInt(match[2], 10)
        });
    });

    seasons.sort((a, b) => {
        if (b.year !== a.year) {
            return b.year - a.year;
        }

        return (seasonOrder[b.season] ?? 99) - (seasonOrder[a.season] ?? 99);
    });

    return {
        status: 'success',
        data: {
            title: cleanText($('.jdlr h1').first().text()) || 'Tahun Rilis',
            seasons
        }
    };
}

async function scrapeGenre(slug, page = 1) {
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const $ = await fetchDocument(buildUrl(`/genres/${slug}/`, currentPage));

    return {
        status: 'success',
        data: {
            title: cleanText($('.jdlr h1').first().text()) || slug,
            latest_releases: parseKoverEntries($),
            pagination: parsePagination($, currentPage)
        }
    };
}

async function scrapeSeason(slug, page = 1) {
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const $ = await fetchDocument(buildUrl(`/seasons/${slug}/`, currentPage));

    return {
        status: 'success',
        data: {
            title: cleanText($('.jdlr h1').first().text()) || slug,
            latest_releases: parseKoverEntries($),
            pagination: parsePagination($, currentPage)
        }
    };
}

module.exports = {
    scrapeAnimeList,
    scrapeGenres,
    scrapeSeasons,
    scrapeGenre,
    scrapeSeason
};
