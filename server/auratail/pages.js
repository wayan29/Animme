const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { BASE_URL, extractStreamingUrls, proxyImageUrl, extractSlug, extractAnimeSlug, extractAnimeId, extractAnimeIdFromSlug } = require('./helpers');

async function scrapeHome() {
    try {
        const { data } = await axios.get(BASE_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const result = {
            featured_anime: [],
            latest_episodes: [],
            trending_anime: [],
            ongoing_series: [],
            completed_series: [],
            latest_updates: [],
            popular_today: [],
            recommendations: []
        };

        // 1. Featured anime from hero slider section
        $('#slidertwo .swiper-slide').each((i, el) => {
            if (i >= 8) return false; // Limit to 8 featured anime
            const $el = $(el);
            
            // Extract from backdrop background image
            const backdropStyle = $el.find('.backdrop').attr('style');
            let poster = null;
            if (backdropStyle) {
                const match = backdropStyle.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
                if (match) {
                    poster = match[1];
                }
            }
            
            // Extract title and URL from h2 > a
            const $titleLink = $el.find('h2 a').first();
            const href = $titleLink.attr('href');
            const title = $titleLink.attr('data-jtitle') || $titleLink.text().trim();
            
            // Extract description from p
            const description = $el.find('.info p').text().trim();

            const genres = [];
            // Find watch link
            const $watchLink = $el.find('.watch');
            const watchUrl = $watchLink.attr('href');

            if (title && (href || watchUrl)) {
                const finalUrl = href || watchUrl;
                result.featured_anime.push({
                    title: title,
                    description: description,
                    slug: extractSlug(finalUrl),
                    anime_id: extractAnimeId(finalUrl),
                    poster: proxyImageUrl(poster),
                    genres: genres,
                    url: finalUrl.startsWith('http') ? finalUrl : `${BASE_URL}${finalUrl}`
                });
            }
        });

        // 2. Latest episodes from latest releases section
        $('.releases.latesthome .bs, .listupd.normal .bs').each((i, el) => {
            if (i >= 25) return false; // Limit to 25 latest episodes
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            // Extract title from h2[title] or clean text from .tt
            let title = $el.find('h2[title]').attr('title') || $el.find('.tt').clone().children().remove().end().text().trim();
            const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src');
            
            const episodeText = $el.find('.epx').text().trim();
            const typeText = $el.find('.typez').text().trim();

            if (title && href) {
                // Extract anime slug and ID from episode URL
                const animeSlug = extractAnimeSlug(href);
                const animeId = extractAnimeIdFromSlug(animeSlug);
                
                result.latest_episodes.push({
                    title: title,
                    slug: animeSlug, // Anime slug for detail page
                    anime_id: animeId, // Anime ID for detail page
                    poster: proxyImageUrl(poster),
                    episode: episodeText || 'Latest',
                    type: typeText || 'ONA',
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                });
            }
        });

        // 3. Popular Today section (from popular slider)
        $('.listupd.popularslider .bs').each((i, el) => {
            if (i >= 15) return false; // Limit to 15 popular today
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            // Extract title from h2[title] or clean text from .tt
            let title = $el.find('h2[title]').attr('title') || $el.find('.tt').clone().children().remove().end().text().trim();
            const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src');
            
            const episodeText = $el.find('.epx').text().trim();

            if (title && href) {
                // Extract anime slug and ID from episode URL
                const animeSlug = extractAnimeSlug(href);
                const animeId = extractAnimeIdFromSlug(animeSlug);
                
                result.popular_today.push({
                    title: title,
                    slug: animeSlug, // Anime slug for detail page
                    anime_id: animeId, // Anime ID for detail page
                    poster: proxyImageUrl(poster),
                    episode: episodeText || 'Popular',
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                });
            }
        });

        // 4. Recommendations section
        $('.releases:not(.latesthome):not(.hothome) .bs').each((i, el) => {
            if (i >= 20) return false; // Limit to 20 recommendations
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            // Extract title from h2[title] or clean text from .tt
            let title = $el.find('h2[title]').attr('title') || $el.find('.tt').clone().children().remove().end().text().trim();
            const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src');
            
            const episodeText = $el.find('.epx').text().trim();
            const typeText = $el.find('.typez').text().trim();

            if (title && href) {
                result.recommendations.push({
                    title: title,
                    slug: extractSlug(href),
                    anime_id: extractAnimeId(href),
                    poster: proxyImageUrl(poster),
                    episode: episodeText || 'Recommended',
                    type: typeText || 'ONA',
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                });
            }
        });

        // 5. Additional ongoing series (from home hot section)
        $('.releases.hothome .bs').each((i, el) => {
            if (i >= 12) return false; // Limit to 12 ongoing
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            // Extract title from h2[title] or clean text from .tt
            let title = $el.find('h2[title]').attr('title') || $el.find('.tt').clone().children().remove().end().text().trim();
            const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src');
            
            const episodeText = $el.find('.epx').text().trim();

            if (title && href) {
                result.ongoing_series.push({
                    title: title,
                    slug: extractSlug(href),
                    anime_id: extractAnimeId(href),
                    poster: proxyImageUrl(poster),
                    episode: episodeText || 'Ongoing',
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                });
            }
        });

        // 6. Additional trending from all remaining .bs elements
        $('.bs').not('.releases .bs').not('.listupd .bs').each((i, el) => {
            if (i >= 10) return false; // Limit to 10 additional trending
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            // Extract title from h2[title] or clean text from .tt
            let title = $el.find('h2[title]').attr('title') || $el.find('.tt').clone().children().remove().end().text().trim();
            const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src');
            
            const episodeText = $el.find('.epx').text().trim();

            if (title && href && !result.trending_anime.find(item => item.url === (href.startsWith('http') ? href : `${BASE_URL}${href}`))) {
                result.trending_anime.push({
                    title: title,
                    slug: extractSlug(href),
                    anime_id: extractAnimeId(href),
                    poster: proxyImageUrl(poster),
                    episode: episodeText || 'Trending',
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                });
            }
        });

        return result;
    } catch (error) {
        console.error('Auratail scrapeHome error:', error.message);
        throw error;
    }
}

async function scrapeDetail(animeId, slug) {
    try {
        const url = `${BASE_URL}/anime/${slug}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const result = {
            title: '',
            alternative_titles: [],
            poster: '',
            synopsis: '',
            info: {},
            genres: [],
            episodes: [],
            batch_list: [],
            anime_lainnya: []
        };

        result.title = $('.entry-title[itemprop="name"]').text().trim();
        result.poster = proxyImageUrl($('img[title="' + result.title + '"]').attr('src') || $('.thumb img').attr('src') || $('.anime-cover img').attr('src'));
        result.synopsis = $('.entry-content[itemprop="description"]').text().trim();

        // Extract info from auratail.vip structure
        $('.spe span').each((i, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            
            if (text.includes('Status:')) {
                result.info.status = text.replace('Status:', '').trim();
            } else if (text.includes('Released:')) {
                result.info.released = text.replace('Released:', '').trim();
            } else if (text.includes('Type:')) {
                result.info.type = text.replace('Type:', '').trim();
            } else if (text.includes('Posted by:')) {
                result.info.posted_by = text.replace('Posted by:', '').trim();
            } else if (text.includes('Released on:')) {
                result.info.released_date = text.replace('Released on:', '').trim();
            } else if (text.includes('Updated on:')) {
                result.info.updated_date = text.replace('Updated on:', '').trim();
            }
        });

        // Alternative titles
        const alterText = $('.alter').text().trim();
        if (alterText && alterText !== result.title) {
            result.alternative_titles.push(alterText);
        }

        // Extract genres
        $('.genxed a').each((i, el) => {
            const genreText = $(el).text().trim();
            if (genreText) {
                result.genres.push(genreText);
            }
        });

        // Episodes list from auratail.vip structure
        $('.eplister ul li a').each((i, el) => {
            const $el = $(el);
            const episodeHref = $el.attr('href');
            const episodeTitle = $el.find('.epl-title').text().trim() || $el.text().trim();
            const episodeDate = $el.find('.epl-date').text().trim() || '';

            if (episodeHref && episodeTitle) {
                result.episodes.push({
                    title: episodeTitle,
                    url: episodeHref.startsWith('http') ? episodeHref : `${BASE_URL}${episodeHref}`,
                    date: episodeDate
                });
            }
        });

        // Batch downloads (if available) - auratail doesn't seem to have batch in detail page
        // Will remain empty for now

        // Related anime from recommendations
        $('.listupd .bs').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.tt').clone().children().remove().end().text().trim();
            const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src');

            if (title && href && title !== result.title) {
                result.anime_lainnya.push({
                    title: title,
                    slug: extractSlug(href),
                    anime_id: extractAnimeId(href),
                    poster: proxyImageUrl(poster),
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                });
            }
        });

        return result;
    } catch (error) {
        console.error('Auratail scrapeDetail error:', error.message);
        throw error;
    }
}

async function scrapeEpisode(animeId, slug, episodeNum) {
    try {
        // Auratail uses format: /{slug}-episode-{num}/
        const url = `${BASE_URL}/${slug}-episode-${episodeNum}/`;
        
        console.log('[Auratail] Fetching episode:', url);
        
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        const $ = cheerio.load(data);
        
        const result = {
            title: '',
            anime_title: '',
            episode: episodeNum,
            anime_detail_url: '',
            episode_list: [],
            current_server: '',
            streaming_servers: [],
            download_links: [],
            navigation: {
                prev_episode: null,
                next_episode: null
            },
            iframe_url: null
        };

        // Title from entry-title
        result.title = $('.entry-title[itemprop="name"]').text().trim() || `Episode ${episodeNum}`;
        
        // Extract anime title from the episode title (remove "Episode X" part)
        const titleMatch = result.title.match(/(.+?)\s*Episode\s*\d+/i);
        result.anime_title = titleMatch ? titleMatch[1].trim() : slug.replace(/-/g, ' ');

        // Anime detail URL - from breadcrumb or construct from slug
        const animeDetailLink = $('.breadcrumb a[href*="/anime/"]').last().attr('href');
        if (animeDetailLink) {
            result.anime_detail_url = animeDetailLink;
        } else {
            result.anime_detail_url = `${BASE_URL}/${slug}/`;
        }

        // Extract iframe URL from player-embed
        const $iframe = $('.player-embed iframe, #pembed iframe, iframe').first();
        if ($iframe.length > 0) {
            result.iframe_url = $iframe.attr('src');
        }

        // Episode list from episodelist section
        $('.episodelist ul li a, .eplister ul li a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const episodeText = $el.find('h3, .epl-title').text().trim() || $el.text().trim();
            const isActive = href && href.includes(`episode-${episodeNum}`);

            if (href && episodeText) {
                // Extract episode number from URL
                const epMatch = href.match(/episode-(\d+)/i);
                const epNum = epMatch ? epMatch[1] : '';

                result.episode_list.push({
                    episode: epNum,
                    title: episodeText,
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    is_active: isActive
                });
            }
        });

        // Navigation - prev/next from naveps section
        // Previous episode
        $('.naveps .nvs a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const text = $el.text().trim().toLowerCase();
            
            if (href && text.includes('prev')) {
                result.navigation.prev_episode = href.startsWith('http') ? href : `${BASE_URL}${href}`;
            } else if (href && text.includes('next')) {
                result.navigation.next_episode = href.startsWith('http') ? href : `${BASE_URL}${href}`;
            }
        });

        // Alternative navigation selectors
        if (!result.navigation.prev_episode) {
            const prevLink = $('.nvs a[href*="episode-"]').filter((i, el) => {
                const epMatch = $(el).attr('href').match(/episode-(\d+)/);
                return epMatch && parseInt(epMatch[1]) < parseInt(episodeNum);
            }).first().attr('href');
            if (prevLink) {
                result.navigation.prev_episode = prevLink.startsWith('http') ? prevLink : `${BASE_URL}${prevLink}`;
            }
        }

        // Current server info
        const currentServerText = $('.current-server, .server-name, .ts-active').text().trim();
        result.current_server = currentServerText || 'Filemoon';

        // Download links (if available)
        $('.download-links a, .download a, .downlot a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const linkText = $el.text().trim();

            if (href && linkText && !href.includes('#')) {
                result.download_links.push({
                    provider: linkText,
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                });
            }
        });

        // Add iframe as streaming server
        if (result.iframe_url) {
            result.streaming_servers.push({
                name: result.current_server || 'Default',
                url: result.iframe_url
            });
        }

        return result;
    } catch (error) {
        console.error('Auratail scrapeEpisode error:', error.message);
        throw error;
    }
}

async function scrapeBatch(animeId, slug, batchRange) {
    try {
        const url = `${BASE_URL}/anime/${slug}/batch/${batchRange}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const result = {
            title: '',
            poster: '',
            synopsis: '',
            info: {},
            genres: [],
            download_links: []
        };

        result.title = $('.entry-title, .batch-title').text().trim().replace('[BATCH]', '').trim();
        result.poster = proxyImageUrl($('.anime-cover img, .poster img').attr('src') || $('.anime-cover img, .poster img').attr('data-src'));
        result.synopsis = $('.synopsis, .plot, .description').text().trim();

        // Extract info
        $('.info-item, .detail-item, .specs li').each((i, el) => {
            const $el = $(el);
            const label = $el.find('.label, .name').text().trim().replace(':', '');
            const $valueCol = $el.find('.value, .val');
            let value = $valueCol.find('a').text().trim();
            if (!value) {
                value = $valueCol.text().trim();
            }

            if (label && value) {
                result.info[label.toLowerCase().replace(/\s+/g, '_')] = value;
            }
        });

        // Extract genres
        $('.genres a, .genre-list a, .tags a').each((i, el) => {
            const genreText = $(el).text().trim();
            if (genreText) {
                result.genres.push(genreText);
            }
        });

        // Download links
        $('.download-links a, .download a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const linkText = $el.text().trim();

            if (href && linkText) {
                result.download_links.push({
                    provider: linkText,
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                });
            }
        });

        return result;
    } catch (error) {
        console.error('Auratail scrapeBatch error:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeHome,
    scrapeDetail,
    scrapeEpisode,
    scrapeBatch
};
