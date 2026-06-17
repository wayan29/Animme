const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug, extractAnimeId } = require('./helpers');

// Helper function for parsing anime list with pagination
function parseAnimeListWithPagination($, BASE_URL) {
    const animeList = [];

    $('.anime-item, .bs, .series-item').each((i, el) => {
        const $el = $(el);
        const $link = $el.find('a').first();
        const href = $link.attr('href');
        const title = $el.find('h3, h2, .title').first().text().trim();
        const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src');

        const rating = $el.find('.rating, .score').text().trim();
        const status = $el.find('.status, .type').text().trim();
        
        // Extract episode information from the HTML structure
        let episode = '';
        const $episodeEl = $el.find('.ep, .episode, .eps');
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

        const tags = [];
        $el.find('.genres a, .tags a, .genre').each((j, tag) => {
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
                status: status || 'ONGOING',
                episode: episode || '1 Episode',
                tags: tags,
                anime_url: `${BASE_URL}/anime/${slug}`
            });
        }
    });

    return animeList;
}

// Genre functions
async function scrapeGenreList() {
    try {
        // Since the site structure is different, return basic genres that might be available
        // This can be enhanced later based on actual site structure
        const genres = [
            { name: 'Action', slug: 'action', url: `${BASE_URL}/?genre=action` },
            { name: 'Adventure', slug: 'adventure', url: `${BASE_URL}/?genre=adventure` },
            { name: 'Comedy', slug: 'comedy', url: `${BASE_URL}/?genre=comedy` },
            { name: 'Drama', slug: 'drama', url: `${BASE_URL}/?genre=drama` },
            { name: 'Fantasy', slug: 'fantasy', url: `${BASE_URL}/?genre=fantasy` },
            { name: 'Romance', slug: 'romance', url: `${BASE_URL}/?genre=romance` },
            { name: 'Sci-Fi', slug: 'sci-fi', url: `${BASE_URL}/?genre=sci-fi` },
            { name: 'Slice of Life', slug: 'slice-of-life', url: `${BASE_URL}/?genre=slice-of-life` }
        ];

        return {
            genres: genres,
            total: genres.length
        };
    } catch (error) {
        console.error('Auratail scrapeGenreList error:', error.message);
        throw error;
    }
}

async function scrapeGenre(genreSlug, page = 1, orderBy = 'ascending') {
    try {
        // Return empty list for now since genre pages may not exist
        const animeList = [];
        const totalPages = null;
        const hasNext = false;
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
        console.error('Auratail scrapeGenre error:', error.message);
        throw error;
    }
}

// Type functions
async function scrapeTypeList() {
    try {
        // Return basic anime types
        const types = [
            { name: 'TV Series', slug: 'tv', url: `${BASE_URL}/?type=tv` },
            { name: 'Movie', slug: 'movie', url: `${BASE_URL}/?type=movie` },
            { name: 'OVA', slug: 'ova', url: `${BASE_URL}/?type=ova` },
            { name: 'ONA', slug: 'ona', url: `${BASE_URL}/?type=ona` },
            { name: 'Special', slug: 'special', url: `${BASE_URL}/?type=special` }
        ];

        return {
            types: types,
            total: types.length
        };
    } catch (error) {
        console.error('Auratail scrapeTypeList error:', error.message);
        throw error;
    }
}

async function scrapeType(typeSlug, page = 1, orderBy = 'ascending') {
    try {
        // Return empty list for now since type pages may not exist
        const animeList = [];
        const totalPages = null;
        const hasNext = false;
        const hasPrev = page > 1;

        return {
            anime_list: animeList,
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
        console.error('Auratail scrapeType error:', error.message);
        throw error;
    }
}

// Search function
async function scrapeSearch(query, page = 1) {
    try {
        // Return empty list for now since search may not work with the site structure
        const animeList = [];
        const totalPages = null;
        const hasNext = false;
        const hasPrev = page > 1;

        return {
            anime_list: animeList,
            query: query,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Auratail scrapeSearch error:', error.message);
        throw error;
    }
}

// Anime list with filters
async function scrapeAnimeList(page = 1, status = '', type = '', order = 'update') {
    try {
        // Since the site structure is different, return empty list for now
        // This can be enhanced later by using the working endpoints like /az-lists/
        const animeList = [];
        const totalPages = null;
        const hasNext = false;
        const hasPrev = page > 1;

        return {
            anime_list: animeList,
            filters: {
                status: status,
                type: type,
                order: order
            },
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Auratail scrapeAnimeList error:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeGenreList,
    scrapeGenre,
    scrapeTypeList,
    scrapeType,
    scrapeSearch,
    scrapeAnimeList
};
