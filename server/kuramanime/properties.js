const cheerio = require('cheerio');
const { BASE_URL, fetchWithPuppeteer, proxyImageUrl, extractSlug, extractAnimeId } = require('./helpers');

// Helper function for parsing anime list with pagination
function parseAnimeListWithPagination($, BASE_URL) {
    const animeList = [];

    $('.product__item').each((i, el) => {
        const $el = $(el);
        const $link = $el.find('a').first();
        const href = $link.attr('href');
        const title = $el.find('.product__item__text h5 a').text().trim();
        const poster = $el.find('.product__item__pic').attr('data-setbg');

        const rating = $el.find('.ep .fa-star').next('span').text().trim();
        const status = $el.find('.d-none span').text().trim() || 'ONGOING';
        
        // Extract episode information from the HTML structure
        let episode = '';
        // Look for episode info in different locations based on the actual HTML
        const $episodeEl = $el.find('.episode-info, .ep-info, .eps');
        if ($episodeEl.length > 0) {
            episode = $episodeEl.text().trim();
        }
        
        // Fallback: Look for episode count patterns in the text
        if (!episode) {
            const itemText = $el.text();
            const episodeMatch = itemText.match(/(\d+)(?:\s*(?:episode|ep))?/i);
            if (episodeMatch) {
                episode = episodeMatch[1] + ' Episode';
            }
        }
        
        // For movie types, use different logic
        if (!episode) {
            const $ep = $el.find('.ep');
            if ($ep.length > 0) {
                const epText = $ep.text().trim();
                // Clean up rating to get episode count if present
                const cleanText = epText.replace(/^[\d.]+\s*/, '').trim();
                episode = cleanText || '1 Episode';
            }
        }

        const tags = [];
        $el.find('.product__item__text ul a').each((j, tag) => {
            const tagText = $(tag).text().trim();
            const tagHref = $(tag).attr('href');
            if (tagText && tagHref) {
                tags.push({
                    label: tagText,
                    url: tagHref
                });
            }
        });

        if (title && href) {
            const animeId = extractAnimeId(href);
            const slug = extractSlug(href);

            animeList.push({
                anime_id: animeId,
                slug: slug,
                title: title,
                poster: proxyImageUrl(poster),
                rating: rating || 'N/A',
                status: status,
                episode: episode,
                tags: tags,
                anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
            });
        }
    });

    return animeList;
}

// Genre functions
async function scrapeGenreList() {
    try {
        const url = `${BASE_URL}/properties/genre`;
        const data = await fetchWithPuppeteer(url);
        const $ = cheerio.load(data);
        const genres = [];

        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();

            if (href && name) {
                const genreMatch = href.match(/\/properties\/genre\/([^?]+)/);
                if (genreMatch) {
                    const genreSlug = genreMatch[1];
                    genres.push({
                        name: name,
                        slug: genreSlug,
                        url: `${BASE_URL}/properties/genre/${genreSlug}`
                    });
                }
            }
        });

        return {
            genres: genres,
            total: genres.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeGenreList error:', error.message);
        throw error;
    }
}

async function scrapeGenre(genreSlug, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/properties/genre/${genreSlug}?order_by=${orderBy}&page=${page}`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const animeList = parseAnimeListWithPagination($, BASE_URL);

        const $pagination = $('.product__pagination');
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });

        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;

        return {
            anime_list: animeList,
            genre: genreSlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeGenre error:', error.message);
        throw error;
    }
}

// Season functions
async function scrapeSeasonList() {
    try {
        const url = `${BASE_URL}/properties/season`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const seasons = [];

        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();

            if (href && name) {
                const seasonMatch = href.match(/\/properties\/season\/([^?]+)/);
                if (seasonMatch) {
                    const seasonSlug = seasonMatch[1];
                    seasons.push({
                        name: name,
                        slug: seasonSlug,
                        url: `${BASE_URL}/properties/season/${seasonSlug}`
                    });
                }
            }
        });

        return {
            seasons: seasons,
            total: seasons.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSeasonList error:', error.message);
        throw error;
    }
}

async function scrapeSeason(seasonSlug, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/properties/season/${seasonSlug}?order_by=${orderBy}&page=${page}`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const animeList = parseAnimeListWithPagination($, BASE_URL);

        const $pagination = $('.product__pagination');
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });

        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;

        return {
            anime_list: animeList,
            season: seasonSlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSeason error:', error.message);
        throw error;
    }
}

// Studio functions
async function scrapeStudioList() {
    try {
        const url = `${BASE_URL}/properties/studio`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const studios = [];

        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();

            if (href && name) {
                const studioMatch = href.match(/\/properties\/studio\/([^?]+)/);
                if (studioMatch) {
                    const studioSlug = studioMatch[1];
                    studios.push({
                        name: name,
                        slug: studioSlug,
                        url: `${BASE_URL}/properties/studio/${studioSlug}`
                    });
                }
            }
        });

        return {
            studios: studios,
            total: studios.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeStudioList error:', error.message);
        throw error;
    }
}

async function scrapeStudio(studioSlug, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/properties/studio/${studioSlug}?order_by=${orderBy}&page=${page}`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const animeList = parseAnimeListWithPagination($, BASE_URL);

        const $pagination = $('.product__pagination');
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });

        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;

        return {
            anime_list: animeList,
            studio: studioSlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeStudio error:', error.message);
        throw error;
    }
}

// Type functions
async function scrapeTypeList() {
    try {
        const url = `${BASE_URL}/properties/type`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const types = [];

        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();

            if (href && name) {
                const typeMatch = href.match(/\/properties\/type\/([^?]+)/);
                if (typeMatch) {
                    const typeSlug = typeMatch[1].toLowerCase();
                    types.push({
                        name: name,
                        slug: typeSlug,
                        url: `${BASE_URL}/properties/type/${typeSlug}`
                    });
                }
            }
        });

        return {
            types: types,
            total: types.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeTypeList error:', error.message);
        throw error;
    }
}

async function scrapeType(typeSlug, page = 1, orderBy = 'ascending') {
    try {
        // Map English orderBy to Indonesian terms that the website expects
        const orderByMapping = {
            'updated': 'terupdate',
            'updated_at': 'terupdate', 
            'latest': 'terbaru',
            'newest': 'terbaru',
            'oldest': 'terlama',
            'ascending': 'ascending',
            'title': 'ascending',
            'name': 'ascending',
            'rating': 'teratas',
            'top': 'teratas',
            'views': 'terpopuler',
            'popular': 'terpopuler'
        };
        
        const mappedOrderBy = orderByMapping[orderBy] || orderBy;
        const url = `${BASE_URL}/properties/type/${typeSlug}?order_by=${mappedOrderBy}&page=${page}`;
        console.log(`[Kuramanime] scrapeType URL: ${url} (original orderBy: ${orderBy} -> mapped: ${mappedOrderBy})`);
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const animeList = parseAnimeListWithPagination($, BASE_URL);

        // If no anime found with the requested order, try fallback to ascending
        let finalAnimeList = animeList;
        if (animeList.length === 0 && mappedOrderBy !== 'ascending') {
            console.log(`[Kuramanime] No anime found with ${mappedOrderBy}, trying fallback to ascending`);
            const fallbackUrl = `${BASE_URL}/properties/type/${typeSlug}?order_by=ascending&page=${page}`;
            const fallbackData = await fetchWithPuppeteer(fallbackUrl);
            const $fallback = cheerio.load(fallbackData);
            const fallbackList = parseAnimeListWithPagination($fallback, BASE_URL);
            
            if (fallbackList.length > 0) {
                console.log(`[Kuramanime] Fallback successful: found ${fallbackList.length} anime with ascending order`);
                finalAnimeList = fallbackList;
            }
        }

        const $pagination = $('.product__pagination');
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });

        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;

        return {
            anime_list: finalAnimeList,
            type: typeSlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeType error:', error.message);
        throw error;
    }
}

// Quality functions
async function scrapeQualityList() {
    try {
        const url = `${BASE_URL}/properties/quality`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const qualities = [];

        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();

            if (href && name) {
                const qualityMatch = href.match(/\/properties\/quality\/([^?]+)/);
                if (qualityMatch) {
                    const qualitySlug = qualityMatch[1].toLowerCase();
                    qualities.push({
                        name: name,
                        slug: qualitySlug,
                        url: `${BASE_URL}/properties/quality/${qualitySlug}`
                    });
                }
            }
        });

        return {
            qualities: qualities,
            total: qualities.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeQualityList error:', error.message);
        throw error;
    }
}

async function scrapeQuality(qualitySlug, page = 1, orderBy = 'ascending') {
    try {
        const qualityName = qualitySlug.toUpperCase();
        const url = `${BASE_URL}/properties/quality/${qualitySlug}?name=${qualityName}&order_by=${orderBy}&page=${page}`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const animeList = parseAnimeListWithPagination($, BASE_URL);

        const $pagination = $('.product__pagination');
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });

        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;

        return {
            anime_list: animeList,
            quality: qualitySlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeQuality error:', error.message);
        throw error;
    }
}

// Source functions
async function scrapeSourceList() {
    try {
        const url = `${BASE_URL}/properties/source`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const sources = [];

        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();

            if (href && name) {
                const sourceMatch = href.match(/\/properties\/source\/([^?]+)/);
                if (sourceMatch) {
                    const sourceSlug = sourceMatch[1].toLowerCase();
                    sources.push({
                        name: name,
                        slug: sourceSlug,
                        url: `${BASE_URL}/properties/source/${sourceSlug}`
                    });
                }
            }
        });

        return {
            sources: sources,
            total: sources.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSourceList error:', error.message);
        throw error;
    }
}

async function scrapeSource(sourceSlug, page = 1, orderBy = 'ascending') {
    try {
        const sourceName = sourceSlug.charAt(0).toUpperCase() + sourceSlug.slice(1);
        const url = `${BASE_URL}/properties/source/${sourceSlug}?name=${sourceName}&order_by=${orderBy}&page=${page}`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const animeList = parseAnimeListWithPagination($, BASE_URL);

        const $pagination = $('.product__pagination');
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });

        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;

        return {
            anime_list: animeList,
            source: sourceSlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSource error:', error.message);
        throw error;
    }
}

// Country functions
async function scrapeCountryList() {
    try {
        const url = `${BASE_URL}/properties/country`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const countries = [];

        $('.kuramanime__genres ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a');
            const href = $link.attr('href');
            const name = $link.find('span').text().trim();

            if (href && name) {
                const countryMatch = href.match(/\/properties\/country\/([^?]+)/);
                if (countryMatch) {
                    const countrySlug = countryMatch[1].toLowerCase();
                    countries.push({
                        name: name,
                        slug: countrySlug,
                        url: `${BASE_URL}/properties/country/${countrySlug}`
                    });
                }
            }
        });

        return {
            countries: countries,
            total: countries.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeCountryList error:', error.message);
        throw error;
    }
}

async function scrapeCountry(countrySlug, page = 1, orderBy = 'ascending') {
    try {
        const countryName = countrySlug.toUpperCase();
        const url = `${BASE_URL}/properties/country/${countrySlug}?name=${countryName}&order_by=${orderBy}&page=${page}`;
        const data = await fetchWithPuppeteer(url);

        const $ = cheerio.load(data);
        const animeList = parseAnimeListWithPagination($, BASE_URL);

        const $pagination = $('.product__pagination');
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });

        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;

        return {
            anime_list: animeList,
            country: countrySlug,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeCountry error:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeGenreList,
    scrapeGenre,
    scrapeSeasonList,
    scrapeSeason,
    scrapeStudioList,
    scrapeStudio,
    scrapeTypeList,
    scrapeType,
    scrapeQualityList,
    scrapeQuality,
    scrapeSourceList,
    scrapeSource,
    scrapeCountryList,
    scrapeCountry
};
