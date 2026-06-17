const cheerio = require('cheerio');
const { BASE_URL, fetchWithPuppeteer, proxyImageUrl, extractSlug, extractAnimeId } = require('./helpers');

async function scrapeAnimeList(page = 1, orderBy = null) {
    try {
        let url = `${BASE_URL}/anime`;
        const params = [];

        if (orderBy) {
            params.push(`order_by=${orderBy}`);
        }
        if (page > 1) {
            params.push(`page=${page}`);
        }

        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        const data = await fetchWithPuppeteer(url);
        const $ = cheerio.load(data);
        const animeList = [];

        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');

            const episodeText = $el.find('.ep span').text().trim();
            const episodeMatch = episodeText.match(/Ep\s+(\d+)\s*\/\s*(.+)/);
            const currentEpisode = episodeMatch ? episodeMatch[1] : null;
            const totalEpisodes = episodeMatch ? episodeMatch[2] : null;

            const isTrending = $el.find('.pin .fa-fire').length > 0;

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
                    current_episode: currentEpisode,
                    total_episodes: totalEpisodes,
                    episode_text: episodeText,
                    is_trending: isTrending,
                    tags: tags,
                    latest_episode_url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });

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
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length,
            order_by: orderBy || 'default'
        };
    } catch (error) {
        console.error('Kuramanime scrapeAnimeList error:', error.message);
        throw error;
    }
}

async function scrapeOngoing(page = 1, orderBy = 'updated') {
    try {
        const url = `${BASE_URL}/quick/ongoing?order_by=${orderBy}&page=${page}`;
        const data = await fetchWithPuppeteer(url);
        const $ = cheerio.load(data);
        const animeList = [];

        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');

            const episodeText = $el.find('.ep span').text().trim();
            const episodeMatch = episodeText.match(/Ep\s+(\d+)\s*\/\s*(.+)/);
            const currentEpisode = episodeMatch ? episodeMatch[1] : null;
            const totalEpisodes = episodeMatch ? episodeMatch[2] : null;

            const isTrending = $el.find('.pin .fa-fire').length > 0;

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
                    current_episode: currentEpisode,
                    total_episodes: totalEpisodes,
                    episode_text: episodeText,
                    is_trending: isTrending,
                    tags: tags,
                    latest_episode_url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });

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
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeOngoing error:', error.message);
        throw error;
    }
}

async function scrapeFinished(page = 1, orderBy = 'updated') {
    try {
        const url = `${BASE_URL}/quick/finished?order_by=${orderBy}&page=${page}`;
        const data = await fetchWithPuppeteer(url);
        const $ = cheerio.load(data);
        const animeList = [];

        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');

            const episodeText = $el.find('.ep span').text().trim();
            const episodeMatch = episodeText.match(/Ep\s+(\d+)\s*\/\s*(.+)/);
            const totalEpisodes = episodeMatch ? episodeMatch[2] : null;

            const isTrending = $el.find('.pin .fa-fire').length > 0;

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

            const episodeUrlMatch = href.match(/episode\/(\d+)/);
            const lastEpisode = episodeUrlMatch ? episodeUrlMatch[1] : totalEpisodes;

            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);

                animeList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    total_episodes: totalEpisodes,
                    last_episode: lastEpisode,
                    episode_text: episodeText,
                    is_trending: isTrending,
                    tags: tags,
                    last_episode_url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });

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
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeFinished error:', error.message);
        throw error;
    }
}

async function scrapeMovie(page = 1, orderBy = 'updated') {
    try {
        const url = `${BASE_URL}/quick/movie?order_by=${orderBy}&page=${page}`;
        const data = await fetchWithPuppeteer(url);
        const $ = cheerio.load(data);
        const animeList = [];

        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');

            const episodeText = $el.find('.ep span').text().trim();
            const isTrending = $el.find('.pin .fa-fire').length > 0;

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
                    episode_text: episodeText,
                    is_trending: isTrending,
                    tags: tags,
                    movie_url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });

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
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_anime: animeList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeMovie error:', error.message);
        throw error;
    }
}

async function scrapeSchedule(day = 'all') {
    try {
        const url = `${BASE_URL}/schedule?scheduled_day=${day}`;
        const data = await fetchWithPuppeteer(url);
        const $ = cheerio.load(data);
        const scheduleList = [];

        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');

            const nextEpisodeText = $el.find('.ep span[class*="actual-schedule-ep"]').text().trim();
            const nextEpisodeMatch = nextEpisodeText.match(/Selanjutnya:\s*Ep\s*(\d+)/);
            const nextEpisode = nextEpisodeMatch ? nextEpisodeMatch[1] : null;

            const scheduleDay = $el.find('.view-end .fa-calendar').next('span').text().trim();
            const scheduleTime = $el.find('.view-end .fa-clock').next('span').text().trim();

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

                scheduleList.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    next_episode: nextEpisode,
                    next_episode_text: nextEpisodeText,
                    schedule_day: scheduleDay,
                    schedule_time: scheduleTime,
                    tags: tags,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });

        return {
            schedule_list: scheduleList,
            day: day,
            total_anime: scheduleList.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSchedule error:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeAnimeList,
    scrapeOngoing,
    scrapeFinished,
    scrapeMovie,
    scrapeSchedule
};
