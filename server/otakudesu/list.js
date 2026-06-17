const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, normalizeImageUrl, proxyImageUrl, extractSlug } = require('./helpers');

// Scrape Ongoing Anime List with Pagination
async function scrapeOngoingAnime(page = 1) {
    try {
        const url = page === 1 ? `${BASE_URL}/ongoing-anime/` : `${BASE_URL}/ongoing-anime/page/${page}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const results = [];

        $('.venz ul li').each((i, el) => {
            const $el = $(el);
            const $thumb = $el.find('.thumb a');
            const $img = $el.find('.thumbz img');
            const posterUrl = normalizeImageUrl($img.attr('src'));

            // Extract episode number - remove "Episode " text and dashicon
            let episodeText = $el.find('.epz').text().trim();
            episodeText = episodeText.replace(/Episode\s*/i, '').replace(/\s+/g, ' ').trim();

            // Extract release day - remove icon and clean text
            let releaseDayText = $el.find('.epztipe').text().trim();
            releaseDayText = releaseDayText.replace(/\s+/g, ' ').trim();

            const anime = {
                title: $el.find('.jdlflm').text().trim(),
                slug: extractSlug($thumb.attr('href')),
                poster: proxyImageUrl(posterUrl),
                poster_original: posterUrl,
                current_episode: episodeText,
                release_day: releaseDayText,
                release_date: $el.find('.newnime').text().trim()
            };

            results.push(anime);
        });

        // Parse Pagination
        const pagination = {
            current_page: page,
            has_next_page: false,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_visible_page: page
        };

        // Find current page and last page from pagination
        const $currentPage = $('.pagination .pagenavix .page-numbers.current');
        if ($currentPage.length > 0) {
            pagination.current_page = parseInt($currentPage.text()) || page;
        }

        // Check if "Next" button exists
        const $nextBtn = $('.pagination .pagenavix .next.page-numbers');
        if ($nextBtn.length > 0) {
            pagination.has_next_page = true;
        }

        // Find last page number
        let lastPage = page;
        $('.pagination .pagenavix .page-numbers').each((i, el) => {
            const pageText = $(el).text().trim();
            const pageNum = parseInt(pageText);
            if (!isNaN(pageNum) && pageNum > lastPage) {
                lastPage = pageNum;
            }
        });

        // Create complete pagination object with consistent fields (Ongoing)
        const finalPagination = {
            current_page: pagination.current_page,
            has_next_page: pagination.has_next_page,
            has_previous_page: pagination.has_previous_page,
            next_page: pagination.next_page,
            previous_page: pagination.previous_page,
            last_page: lastPage,
            total_pages: lastPage,
            last_visible_page: lastPage
        };

        return {
            status: 'success',
            data: {
                ongoingAnimeData: results,
                paginationData: finalPagination
            }
        };
    } catch (error) {
        console.error('Error scraping ongoing:', error.message);
        throw error;
    }
}

// Scrape Complete Anime List with Pagination
async function scrapeCompleteAnime(page = 1) {
    try {
        const url = page === 1 ? `${BASE_URL}/complete-anime/` : `${BASE_URL}/complete-anime/page/${page}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const results = [];

        $('.venz ul li').each((i, el) => {
            const $el = $(el);
            const $thumb = $el.find('.thumb a');
            const $img = $el.find('.thumbz img');

            // Extract episode count - remove "Episode" text and dashicon
            let episodeText = $el.find('.epz').text().trim();
            episodeText = episodeText.replace(/Episode\s*/i, '').replace(/\s+/g, ' ').trim();

            // Extract rating - remove icon and clean text
            let ratingText = $el.find('.epztipe').text().trim();
            ratingText = ratingText.replace(/\s+/g, ' ').trim();

            const anime = {
                title: $el.find('.jdlflm').text().trim(),
                slug: extractSlug($thumb.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                episode_count: episodeText,
                rating: ratingText,
                release_date: $el.find('.newnime').text().trim()
            };

            results.push(anime);
        });

        // Parse Pagination
        const pagination = {
            current_page: page,
            has_next_page: false,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_visible_page: page
        };

        // Find current page and last page from pagination
        const $currentPage = $('.pagination .pagenavix .page-numbers.current');
        if ($currentPage.length > 0) {
            pagination.current_page = parseInt($currentPage.text()) || page;
        }

        // Check if "Next" button exists
        const $nextBtn = $('.pagination .pagenavix .next.page-numbers');
        if ($nextBtn.length > 0) {
            pagination.has_next_page = true;
        }

        // Find last page number
        let lastPage = page;
        $('.pagination .pagenavix .page-numbers').each((i, el) => {
            const pageText = $(el).text().trim();
            const pageNum = parseInt(pageText);
            if (!isNaN(pageNum) && pageNum > lastPage) {
                lastPage = pageNum;
            }
        });

        // Create complete pagination object with consistent fields (Complete)
        const finalPagination = {
            current_page: pagination.current_page,
            has_next_page: pagination.has_next_page,
            has_previous_page: pagination.has_previous_page,
            next_page: pagination.next_page,
            previous_page: pagination.previous_page,
            last_page: lastPage,
            total_pages: lastPage,
            last_visible_page: lastPage
        };

        return {
            status: 'success',
            data: {
                completedAnimeData: results,
                paginationData: finalPagination
            }
        };
    } catch (error) {
        console.error('Error scraping complete anime:', error.message);
        throw error;
    }
}

// Scrape Anime by Genre with Pagination
async function scrapeGenreAnime(genreSlug, page = 1) {
    try {
        const url = page === 1
            ? `${BASE_URL}/genres/${genreSlug}/`
            : `${BASE_URL}/genres/${genreSlug}/page/${page}/`;

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const results = [];

        // Parse each anime
        $('.col-anime-con').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.col-anime-title a');
            const $img = $el.find('.col-anime-cover img');

            const genres = [];
            $el.find('.col-anime-genre a').each((j, genreEl) => {
                genres.push({
                    name: $(genreEl).text().trim()
                });
            });

            const anime = {
                title: $link.text().trim(),
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                studio: $el.find('.col-anime-studio').text().trim(),
                episode_count: $el.find('.col-anime-eps').text().trim(),
                rating: $el.find('.col-anime-rating').text().trim(),
                genres: genres,
                synopsis: $el.find('.col-synopsis p').text().trim(),
                release_date: $el.find('.col-anime-date').text().trim()
            };

            results.push(anime);
        });

        // Parse Pagination
        const pagination = {
            current_page: page,
            has_next_page: false,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_visible_page: page
        };

        // Find current page and last page from pagination
        const $currentPage = $('.pagination .pagenavix .page-numbers.current');
        if ($currentPage.length > 0) {
            pagination.current_page = parseInt($currentPage.text()) || page;
        }

        // Check if "Next" button exists
        const $nextBtn = $('.pagination .pagenavix .next.page-numbers');
        if ($nextBtn.length > 0) {
            pagination.has_next_page = true;
        }

        // Find last page number
        let lastPage = page;
        $('.pagination .pagenavix .page-numbers').each((i, el) => {
            const pageText = $(el).text().trim();
            const pageNum = parseInt(pageText);
            if (!isNaN(pageNum) && pageNum > lastPage) {
                lastPage = pageNum;
            }
        });
        pagination.last_visible_page = lastPage;

        return {
            status: 'success',
            data: {
                genreAnimeData: results,
                paginationData: pagination
            }
        };
    } catch (error) {
        console.error('Error scraping genre anime:', error.message);
        throw error;
    }
}

// Scrape Genre List
async function scrapeGenreList() {
    try {
        const url = `${BASE_URL}/genre-list/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const genres = [];

        // Parse genres from the list
        $('.genres li a').each((i, el) => {
            const $link = $(el);
            const href = $link.attr('href');
            const name = $link.text().trim();

            // Extract slug from href (/genres/action/ -> action)
            const slugMatch = href ? href.match(/\/genres\/([^\/]+)/) : null;
            const slug = slugMatch ? slugMatch[1] : '';

            if (name && slug) {
                genres.push({
                    name: name,
                    slug: slug
                });
            }
        });

        return {
            status: 'success',
            data: genres
        };
    } catch (error) {
        console.error('Error scraping genre list:', error.message);
        throw error;
    }
}

// Scrape All Anime List (Alphabetically organized)
async function scrapeAllAnime() {
    try {
        const url = `${BASE_URL}/anime-list/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const result = [];

        // Parse each alphabetical section
        $('.bariskelom').each((i, section) => {
            const $section = $(section);

            // Get the letter/number header
            const letter = $section.find('.barispenz a').attr('name') || '';

            // Parse anime items in this section
            const animeList = [];
            $section.find('.jdlbar ul li').each((j, el) => {
                const $link = $(el).find('a.hodebgst');
                const href = $link.attr('href');
                const title = $link.attr('title') || $link.text().trim();

                // Clean title - remove extra text like "(Episode 1-12) Subtitle Indonesia"
                let cleanTitle = title.replace(/\s*\(Episode.*?\)\s*Subtitle Indonesia/i, '').trim();
                cleanTitle = cleanTitle.replace(/\s*BD\s*$/i, '').trim();

                if (href && cleanTitle) {
                    animeList.push({
                        title: cleanTitle,
                        slug: extractSlug(href)
                    });
                }
            });

            // Only add section if it has anime items
            if (letter && animeList.length > 0) {
                result.push({
                    letter: letter,
                    anime: animeList
                });
            }
        });

        return {
            status: 'success',
            data: result
        };
    } catch (error) {
        console.error('Error scraping all anime:', error.message);
        throw error;
    }
}

// Scrape Schedule
async function scrapeSchedule() {
    try {
        const url = `${BASE_URL}/jadwal-rilis/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const schedule = {};

        // Parse each day schedule
        $('.kglist321').each((i, el) => {
            const $el = $(el);
            const day = $el.find('h2').text().trim();
            const animeList = [];

            $el.find('ul li a').each((idx, linkEl) => {
                const $link = $(linkEl);
                const title = $link.text().trim();
                const href = $link.attr('href');

                // Extract slug from href
                let slug = '';
                if (href) {
                    const slugMatch = href.match(/\/anime\/([^\/]+)/);
                    slug = slugMatch ? slugMatch[1] : '';
                }

                if (title && slug) {
                    animeList.push({
                        title: title,
                        slug: slug
                    });
                }
            });

            if (day && animeList.length > 0) {
                schedule[day] = animeList;
            }
        });

        return {
            status: 'success',
            data: schedule
        };
    } catch (error) {
        console.error('Error scraping schedule:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeOngoingAnime,
    scrapeCompleteAnime,
    scrapeGenreAnime,
    scrapeGenreList,
    scrapeAllAnime,
    scrapeSchedule
};
