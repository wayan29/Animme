const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText } = require('./helpers');

// Scrape hentai list (A-Z listing)
async function scrapeHentaiList() {
    try {
        const url = `${BASE_URL}/hentai-list/`;
        const $ = await fetchPage(url);

        const list = [];
        const letters = {};

        // Parse letter groups
        $('.letter-group').each((_, element) => {
            const $group = $(element);

            // Get letter name
            const letterCell = $group.find('.letter-cell a').first();
            const letter = cleanText(letterCell.text() || letterCell.attr('name'));

            if (!letter) return;

            // Initialize letter array if not exists
            if (!letters[letter]) {
                letters[letter] = [];
            }

            // Parse anime in this letter group
            $group.find('.title-cell a.series').each((_, elem) => {
                const $link = $(elem);
                const title = cleanText($link.text());
                const url = $link.attr('href');
                const rel = $link.attr('rel'); // anime ID

                if (title && url) {
                    const anime = {
                        title,
                        slug: extractSlugFromUrl(url),
                        url,
                        id: rel,
                        letter
                    };

                    letters[letter].push(anime);
                    list.push(anime);
                }
            });
        });

        // Convert letters object to sorted array
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
            message: error.message
        };
    }
}

// Scrape hentai list by specific letter
async function scrapeHentaiListByLetter(letter) {
    try {
        const url = `${BASE_URL}/hentai-list/`;
        const $ = await fetchPage(url);

        const animeList = [];

        // Find the specific letter group
        $(`.letter-group`).each((_, element) => {
            const $group = $(element);

            // Get letter name
            const letterCell = $group.find('.letter-cell a').first();
            const groupLetter = cleanText(letterCell.text() || letterCell.attr('name'));

            // Check if this is the requested letter
            if (groupLetter.toUpperCase() === letter.toUpperCase()) {
                // Parse anime in this letter group
                $group.find('.title-cell a.series').each((_, elem) => {
                    const $link = $(elem);
                    const title = cleanText($link.text());
                    const url = $link.attr('href');
                    const rel = $link.attr('rel'); // anime ID

                    if (title && url) {
                        animeList.push({
                            title,
                            slug: extractSlugFromUrl(url),
                            url,
                            id: rel,
                            letter: groupLetter
                        });
                    }
                });
            }
        });

        return {
            status: 'success',
            data: {
                letter,
                count: animeList.length,
                anime: animeList
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message
        };
    }
}

module.exports = {
    scrapeHentaiList,
    scrapeHentaiListByLetter
};
