const cheerio = require('cheerio');
const { BASE_URL, fetchPage, extractSlugFromUrl, cleanText } = require('./helpers');

function parseTooltipTitle(tooltip = '') {
    if (!tooltip) return '';
    try {
        const $fragment = cheerio.load(`<div>${tooltip}</div>`);
        return cleanText($fragment('h2').first().text());
    } catch {
        return '';
    }
}

function humanizeSlug(slug = '') {
    return cleanText(String(slug).replace(/[-_]+/g, ' '));
}

function extractListItem($, link, letter) {
    const $link = $(link);
    const url = $link.attr('href');
    const rel = $link.attr('rel');
    const slug = extractSlugFromUrl(url);
    const title = cleanText($link.text())
        || parseTooltipTitle($link.attr('original-title'))
        || parseTooltipTitle($link.attr('data-original-title'))
        || humanizeSlug(slug);

    if (!title || !url) return null;

    return {
        title,
        slug,
        url,
        id: rel || null,
        letter
    };
}

function parseListGroups($, targetLetter = '') {
    const list = [];
    const letters = {};
    const normalizedTarget = targetLetter ? String(targetLetter).toUpperCase() : '';

    const groups = $('#nk-az-list .nk-az-group, .nk-az-group, .letter-group');
    groups.each((_, element) => {
        const $group = $(element);
        const letterCell = $group.find('.nk-az-letter a, .letter-cell a').first();
        const letter = cleanText(letterCell.attr('name') || letterCell.text()).toUpperCase();

        if (!letter) return;
        if (normalizedTarget && letter !== normalizedTarget) return;

        if (!letters[letter]) {
            letters[letter] = [];
        }

        const links = $group.find('a.nk-series-link[href], .title-cell a.series[href], a[href*="/hentai/"]');
        links.each((__, link) => {
            const anime = extractListItem($, link, letter);
            if (!anime) return;

            letters[letter].push(anime);
            list.push(anime);
        });
    });

    // Last-resort fallback for current links if group selector changes.
    if (list.length === 0 && !normalizedTarget) {
        $('a.nk-series-link[href], a[href*="/hentai/"]').each((_, link) => {
            const $link = $(link);
            const $group = $link.closest('.nk-az-group, .letter-group');
            const letterCell = $group.find('.nk-az-letter a, .letter-cell a').first();
            const letter = cleanText(letterCell.attr('name') || letterCell.text()).toUpperCase() || '#';
            if (!letters[letter]) letters[letter] = [];

            const anime = extractListItem($, link, letter);
            if (!anime) return;
            letters[letter].push(anime);
            list.push(anime);
        });
    }

    return { list, letters };
}

async function scrapeAzList(pathname = 'hentai-list', label = 'hentai list') {
    try {
        const url = `${BASE_URL}/${pathname}/`;
        const $ = await fetchPage(url);
        const { list, letters } = parseListGroups($);

        if (list.length === 0) {
            return {
                status: 'error',
                message: `No ${label} entries found; upstream DOM may have changed`,
                data: null
            };
        }

        const letterList = Object.keys(letters).sort().map(letter => ({
            letter,
            count: letters[letter].length,
            anime: letters[letter]
        }));

        return {
            status: 'success',
            data: {
                totalAnime: list.length,
                letters: letterList,
                allAnime: list
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

async function scrapeAzListByLetter(pathname = 'hentai-list', letter) {
    try {
        const normalizedLetter = String(letter || '').trim().toUpperCase();
        const url = `${BASE_URL}/${pathname}/`;
        const $ = await fetchPage(url);
        const { list } = parseListGroups($, normalizedLetter);

        return {
            status: 'success',
            data: {
                letter: normalizedLetter,
                count: list.length,
                anime: list
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

// Scrape hentai list (A-Z listing)
async function scrapeHentaiList() {
    return scrapeAzList('hentai-list', 'hentai list');
}

// Scrape hentai list by specific letter
async function scrapeHentaiListByLetter(letter) {
    return scrapeAzListByLetter('hentai-list', letter);
}

async function scrapeJavList() {
    return scrapeAzList('jav-list', 'JAV list');
}

async function scrapeJavListByLetter(letter) {
    return scrapeAzListByLetter('jav-list', letter);
}

module.exports = {
    scrapeHentaiList,
    scrapeHentaiListByLetter,
    scrapeJavList,
    scrapeJavListByLetter
};
