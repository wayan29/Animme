const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug, fetchDocument } = require('./helpers');

// Scrape Anime Terbaru dengan Pagination
async function scrapeAnimeList(page = 1) {
    try {
        const url = page === 1 ? `${BASE_URL}/anime-terbaru/` : `${BASE_URL}/anime-terbaru/page/${page}/`;
        const $ = await fetchDocument(url);
        const results = [];

        // Scrape dari post-show area (16 items)
        $('.post-show ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.dtla h2 a');
            const $img = $el.find('.thumb img');

            const anime = {
                title: $link.text().trim(),
                slug: extractSlug($link.attr('href')),
                poster: proxyImageUrl($img.attr('src')),
                current_episode: $el.find('.dtla span').first().text().replace(/Episode\s*/i, '').replace(/\s*Posted by.*/, '').trim(),
                release_date: $el.find('.dtla span:contains("Released on")').text().replace(/Released on:\s*/, '').trim()
            };

            results.push(anime);
        });

        // Debug info can be uncommented if needed
        // console.log(`[V2] Scraped ${results.length} anime from page ${page}`);

        // Parse Pagination - Extract from HTML structure
        let lastPage = page;

        // Method 1: Look for the span that contains "Page 1 of 675"
        const $paginationSpan = $('.pagination span').first();
        if ($paginationSpan.length > 0) {
            const spanText = $paginationSpan.text();
            const pageMatch = spanText.match(/Page\s+\d+\s+of\s+(\d+)/i);
            if (pageMatch) {
                lastPage = parseInt(pageMatch[1]);
            }
        }

        // Method 2: Get the highest page number from pagination links
        if (lastPage === page) {
            let highestPage = page;
            $('.pagination a').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    const pageMatch = href.match(/page\/(\d+)/);
                    if (pageMatch) {
                        const pageNum = parseInt(pageMatch[1]);
                        if (pageNum > highestPage) {
                            highestPage = pageNum;
                        }
                    }
                }
            });
            lastPage = highestPage;
        }

        // Method 3: Fallback - use any page number found in pagination text
        if (lastPage === page) {
            const paginationText = $('.pagination').text().trim();
            const allNumbers = paginationText.match(/\b\d{1,4}\b/g);
            if (allNumbers && allNumbers.length > 0) {
                // Find the largest reasonable page number (not too big like 675123)
                const reasonablePages = allNumbers
                    .map(n => parseInt(n))
                    .filter(n => n > page && n < 10000)
                    .sort((a, b) => a - b);
                if (reasonablePages.length > 0) {
                    lastPage = reasonablePages[reasonablePages.length - 1];
                }
            }
        }

        const pagination = {
            current_page: page,
            has_next_page: page < lastPage,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_page: lastPage,
            total_pages: lastPage
        };

        // Also check if next button exists as fallback
        const $nextBtn = $('.pagination .next');
        if ($nextBtn.length > 0) {
            pagination.has_next_page = true;
        }

        return {
            status: 'success',
            data: {
                animeData: results,
                paginationData: pagination
            }
        };
    } catch (error) {
        console.error('Error scraping samehadaku anime list:', error.message);
        throw error;
    }
}

// Scrape Schedule (Jadwal Rilis)
async function scrapeSchedule() {
    try {
        const url = `${BASE_URL}/jadwal-rilis/`;
        const $ = await fetchDocument(url);
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
        console.error('Error scraping samehadaku schedule:', error.message);
        throw error;
    }
}

// Scrape All Anime (Daftar Anime) with filters and pagination
async function scrapeAllAnime(filters = {}, page = 1) {
    try {
        // Build URL with query parameters
        const params = new URLSearchParams();

        if (filters.title) params.append('title', filters.title);
        if (filters.status) params.append('status', filters.status);
        if (filters.type) params.append('type', filters.type);
        if (filters.order) params.append('order', filters.order);
        if (filters.genre && Array.isArray(filters.genre)) {
            filters.genre.forEach(g => params.append('genre[]', g));
        }

        const queryString = params.toString();

        // Build URL with page number
        let url;
        if (page > 1) {
            url = queryString
                ? `${BASE_URL}/daftar-anime-2/page/${page}/?${queryString}`
                : `${BASE_URL}/daftar-anime-2/page/${page}/`;
        } else {
            url = queryString
                ? `${BASE_URL}/daftar-anime-2/?${queryString}`
                : `${BASE_URL}/daftar-anime-2/`;
        }

        const $ = await fetchDocument(url);
        const results = [];

        // Parse anime list from .relat container
        $('.relat article.animpost').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.animposx a');
            const $img = $link.find('.content-thumb img');
            const $title = $link.find('.data .title h2');
            const $status = $link.find('.data .type');
            const $typeLabel = $link.find('.content-thumb .type');
            const $rating = $link.find('.content-thumb .score');

            // Get metadata from tooltip
            const $tooltip = $el.find('.stooltip');
            const $views = $tooltip.find('.metadata span:contains("Views")');
            const synopsis = $tooltip.find('.ttls').text().trim();

            // Parse genres from tooltip
            const genres = [];
            $tooltip.find('.genres .mta a').each((j, genreEl) => {
                const genreName = $(genreEl).text().trim();
                const genreHref = $(genreEl).attr('href');
                const genreSlugMatch = genreHref ? genreHref.match(/\/genre\/([^\/]+)/) : null;

                if (genreName && genreSlugMatch) {
                    genres.push({
                        name: genreName,
                        slug: genreSlugMatch[1]
                    });
                }
            });

            const title = $title.text().trim();
            const href = $link.attr('href');
            const slug = extractSlug(href);

            if (title && slug) {
                results.push({
                    title: title,
                    slug: slug,
                    poster: proxyImageUrl($img.attr('src')),
                    type: $typeLabel.text().trim(),
                    status: $status.text().trim(),
                    rating: $rating.text().replace(/★/g, '').trim(),
                    views: $views.text().replace(/\s*Views/, '').trim(),
                    synopsis: synopsis,
                    genres: genres
                });
            }
        });

        // Parse available filters/options from the page
        const availableFilters = {
            statuses: [],
            types: [],
            sorts: [],
            genres: []
        };

        // Parse status options
        $('input[name="status"]').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const label = $el.parent().text().trim();
            if (value && label) {
                availableFilters.statuses.push({ value, label });
            }
        });

        // Parse type options
        $('input[name="type"]').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const label = $el.parent().text().trim();
            if (value && label) {
                availableFilters.types.push({ value, label });
            }
        });

        // Parse sort options
        $('input[name="order"]').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const label = $el.parent().text().trim();
            if (value && label) {
                availableFilters.sorts.push({ value, label });
            }
        });

        // Parse genre options
        $('input[name="genre[]"]').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const label = $el.parent().text().trim();
            if (value && label) {
                availableFilters.genres.push({ value, label });
            }
        });

        // Parse pagination info
        const pagination = {
            current_page: page,
            has_next_page: false,
            has_previous_page: page > 1,
            next_page: page + 1,
            previous_page: page - 1,
            last_page: page,
            total_pages: page
        };

        // Try to find pagination info in the page
        const $pagination = $('.pagination');
        if ($pagination.length > 0) {
            let maxPage = page;

            // First priority: Look for "Page X of Y" span (most reliable)
            let foundPageOf = false;
            $pagination.find('span').each((i, el) => {
                const $el = $(el);
                const text = $el.text().trim();
                const pageOfMatch = text.match(/^Page\s+(\d+)\s+of\s+(\d+)$/i);
                if (pageOfMatch) {
                    maxPage = parseInt(pageOfMatch[2]);
                    foundPageOf = true;
                    // If current page is less than max page, there's a next page
                    if (page < maxPage) {
                        pagination.has_next_page = true;
                    }
                    return false; // Break loop
                }
            });

            if (!foundPageOf) {
                // Fallback: Try to extract page numbers from links
                $pagination.find('a').each((i, el) => {
                    const $el = $(el);
                    const href = $el.attr('href');
                    const text = $el.text().trim();

                    // Check href for page number
                    if (href) {
                        const pageMatch = href.match(/page\/(\d+)/);
                        if (pageMatch) {
                            const pageNum = parseInt(pageMatch[1]);
                            if (pageNum > page) {
                                pagination.has_next_page = true;
                            }
                            if (pageNum > maxPage) {
                                maxPage = pageNum;
                            }
                        }
                    }

                    // Check text for page number (only pure numbers)
                    const textNum = parseInt(text);
                    if (!isNaN(textNum) && text === textNum.toString()) {
                        if (textNum > maxPage) {
                            maxPage = textNum;
                        }
                    }
                });

                // Look for "next" arrow or button
                $pagination.find('a').each((i, el) => {
                    const $el = $(el);
                    const className = $el.attr('class') || '';
                    const id = $el.attr('id') || '';
                    const html = $el.html();

                    // Check for next indicators
                    if (className.includes('arrow_pag') ||
                        id.includes('nextpagination') ||
                        className.includes('next') ||
                        html.includes('fa-caret-right') ||
                        html.includes('fa-arrow-right')) {
                        pagination.has_next_page = true;
                    }
                });
            }

            pagination.last_page = maxPage;
            pagination.total_pages = maxPage;
        }

        return {
            status: 'success',
            data: {
                animeData: results,
                filters: availableFilters,
                currentFilters: filters,
                pagination: pagination,
                total_results: results.length
            }
        };
    } catch (error) {
        console.error('Error scraping samehadaku all anime:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeAnimeList,
    scrapeSchedule,
    scrapeAllAnime
};
