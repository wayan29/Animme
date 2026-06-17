// AnimeIndo Anime List Scraper
const {
    BASE_URL,
    fetchPage,
    cleanText,
    extractSlugFromUrl,
    toAbsoluteUrl
} = require('./helpers');

function normalizeLetter(value = '') {
    return cleanText(value || '').toUpperCase();
}

function collectAvailableLetters($) {
    const letters = [];
    $('.pilih a').each((_, link) => {
        const text = cleanText($(link).text());
        if (text) {
            letters.push(text.toUpperCase());
        }
    });
    return Array.from(new Set(letters));
}

function parseAnimeListSections($) {
    const sections = [];
    const container = $('.anime-list').first();

    if (!container || container.length === 0) {
        return { sections, total: 0 };
    }

    let currentSection = null;
    let total = 0;

    container.children().each((_, node) => {
        const $node = $(node);

        if ($node.hasClass('letter')) {
            const letterText = cleanText($node.text()) || '#';
            currentSection = {
                letter: letterText,
                anime_list: []
            };
            sections.push(currentSection);
            return;
        }

        if (!$node.is('li') || !currentSection) {
            return;
        }

        const $link = $node.find('a').first();
        const title = cleanText($link.text());
        const href = $link.attr('href');

        if (!title || !href) {
            return;
        }

        currentSection.anime_list.push({
            title,
            slug: extractSlugFromUrl(href),
            url: toAbsoluteUrl(href)
        });
        total += 1;
    });

    return {
        sections: sections.filter(section => section.anime_list.length > 0),
        total
    };
}

async function scrapeAnimeList(letter = 'ALL') {
    const filterLetter = cleanText(letter || '').toUpperCase();
    const $ = await fetchPage(`${BASE_URL}/anime-list/`);

    const availableLetters = collectAvailableLetters($);
    if (!availableLetters.includes('ALL')) {
        availableLetters.unshift('ALL');
    }

    const { sections, total } = parseAnimeListSections($);

    const normalizedFilter = filterLetter && filterLetter !== 'ALL'
        ? filterLetter
        : 'ALL';

    const filteredSections = normalizedFilter === 'ALL'
        ? sections
        : sections.filter(section => normalizeLetter(section.letter) === normalizedFilter);

    const animeList = filteredSections.flatMap(section => section.anime_list);

    return {
        status: 'success',
        data: {
            letter: normalizedFilter,
            total: animeList.length,
            sections: filteredSections,
            anime_list: animeList,
            available_letters: availableLetters,
            all_total: total
        }
    };
}

module.exports = {
    scrapeAnimeList
};
