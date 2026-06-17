// Kusonime V8 Scraper - Homepage

const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug, cleanText } = require('./helpers');

function extractPageNumber(url) {
    if (!url) return null;

    const match = url.match(/\/page\/(\d+)\/?/);
    return match ? parseInt(match[1], 10) : 1;
}

async function scrapeHome(page = 1) {
    try {
        const currentPage = Math.max(parseInt(page, 10) || 1, 1);
        const targetUrl = currentPage > 1 ? `${BASE_URL}/page/${currentPage}/` : BASE_URL;

        const { data } = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const result = {
            latest_releases: [],
            ongoing_anime: [],
            pagination: {
                current_page: currentPage,
                last_page: currentPage,
                has_next_page: false,
                has_previous_page: currentPage > 1,
                next_page: null,
                previous_page: currentPage > 1 ? currentPage - 1 : null
            }
        };

        // Parse latest anime releases from Kusonime
        // Kusonime uses .kover > .detpost structure
        $('.kover').each((i, el) => {
            const $el = $(el);
            const $detpost = $el.find('.detpost');

            // Find title and link
            const $titleLink = $detpost.find('h2.episodeye a').first();
            const title = cleanText($titleLink.text());
            const href = $titleLink.attr('href');

            // Find image
            const $img = $detpost.find('.thumb img').first();
            const poster = $img.attr('src') || $img.attr('data-src');

            // Extract genres
            const genres = [];
            $detpost.find('.fa-tag').parent().find('a[rel="tag"]').each((j, genreEl) => {
                const genre = cleanText($(genreEl).text());
                if (genre) {
                    genres.push(genre);
                }
            });

            // Extract release date
            let releaseDate = '';
            const $dateP = $detpost.find('.fa-clock-o').parent();
            if ($dateP.length > 0) {
                releaseDate = cleanText($dateP.text().replace('Released on', '').replace(/[^0-9:apm ]+/gi, ''));
            }

            // Extract author
            const $authorP = $detpost.find('.fa-user').parent();
            const author = $authorP.length > 0 ? cleanText($authorP.text().replace('Posted by', '')) : '';

            if (title && href) {
                const animeData = {
                    title: title,
                    slug: extractSlug(href),
                    poster: proxyImageUrl(poster),
                    genres: genres,
                    release_date: releaseDate || 'Unknown',
                    author: author,
                    url: href
                };

                result.latest_releases.push(animeData);
            }
        });

        // Limit to 16 items for better performance
        result.latest_releases = result.latest_releases.slice(0, 16);

        const $pagination = $('.wp-pagenavi').first();
        const pagesText = cleanText($pagination.find('.pages').text());
        const lastPageMatch = pagesText.match(/Page\s+\d+\s+of\s+(\d+)/i);
        const lastPage = lastPageMatch ? parseInt(lastPageMatch[1], 10) : currentPage;
        const nextPage = extractPageNumber($pagination.find('.nextpostslink').attr('href'));
        const previousPage = extractPageNumber($pagination.find('.previouspostslink').attr('href'));

        result.pagination = {
            current_page: currentPage,
            last_page: lastPage,
            has_next_page: Boolean(nextPage && nextPage > currentPage),
            has_previous_page: currentPage > 1,
            next_page: nextPage && nextPage > currentPage ? nextPage : null,
            previous_page: currentPage > 1 ? (previousPage || currentPage - 1) : null
        };

        return {
            status: 'success',
            data: result
        };
    } catch (error) {
        console.error('[Kusonime] Error scraping home:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeHome
};
