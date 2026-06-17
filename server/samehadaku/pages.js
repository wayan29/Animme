const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug, fetchAjaxPlayerIframe, fetchDocument } = require('./helpers');

// Scrape Homepage - Top 10 & Anime Terbaru
async function scrapeHome() {
    try {
        const $ = await fetchDocument(BASE_URL);
        const result = {
            top10_weekly: [],
            project_movie: [],
            recent_anime: []
        };

        // Parse Top 10 minggu ini
        $('.topten-animesu ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a.series');
            const href = $link.attr('href');
            const title = $link.find('.judul').text().trim();
            const img = $link.find('img').attr('src');
            const rating = $link.find('.rating').text().replace(/★/g, '').trim();
            const rank = $link.find('.is-topten b:last-child').text().trim();

            if (title && href) {
                result.top10_weekly.push({
                    rank: parseInt(rank) || i + 1,
                    title: title,
                    slug: extractSlug(href),
                    poster: proxyImageUrl(img),
                    rating: rating
                });
            }
        });

        // Parse Project Movie Samehadaku
        $('.widgets h3:contains("Project Movie")').next('.widget-post').find('.widgetseries ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.lftinfo h2 a.series');
            const $img = $el.find('.imgseries a.series img');
            const href = $link.attr('href');
            const title = $link.text().trim();
            const img = $img.attr('src');

            // Parse genres
            const genres = [];
            $el.find('.lftinfo span:contains("Genres") a').each((j, genreEl) => {
                genres.push($(genreEl).text().trim());
            });

            // Parse release date
            const releaseDate = $el.find('.lftinfo span').last().text().trim();

            if (title && href) {
                result.project_movie.push({
                    title: title,
                    slug: extractSlug(href),
                    poster: proxyImageUrl(img),
                    genres: genres,
                    release_date: releaseDate
                });
            }
        });

        // Parse Anime Terbaru dari homepage
        $('.post-show ul li').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('.dtla h2.entry-title a');
            const $img = $el.find('.thumb img');

            // Extract episode number
            let episodeText = '';
            const $episodeSpan = $el.find('.dtla span:contains("Episode")');
            if ($episodeSpan.length > 0) {
                const episodeAuthor = $episodeSpan.find('author').text().trim();
                episodeText = episodeAuthor || $episodeSpan.text().replace(/Episode\s*/i, '').replace(/\s*Posted by.*/i, '').trim();
            }

            // Extract release date
            let releaseText = '';
            const $releaseSpan = $el.find('.dtla span:contains("Released on")');
            if ($releaseSpan.length > 0) {
                releaseText = $releaseSpan.text().replace(/Released on:\s*/i, '').trim();
            }

            const title = $link.text().trim();
            const href = $link.attr('href');

            if (title && href) {
                // Extract base slug from href
                let slug = extractSlug(href);

                // If slug doesn't contain "episode" but we have episode number, add it
                if (episodeText && !slug.includes('episode')) {
                    slug = `${slug}-episode-${episodeText}`;
                }

                result.recent_anime.push({
                    title: title,
                    slug: slug,
                    poster: proxyImageUrl($img.attr('src')),
                    current_episode: episodeText,
                    release_date: releaseText
                });
            }
        });

        return {
            status: 'success',
            data: result
        };
    } catch (error) {
        console.error('Error scraping samehadaku home:', error.message);
        throw error;
    }
}

// Scrape Anime Detail
async function scrapeAnimeDetail(slug) {
    try {
        const url = `${BASE_URL}/anime/${slug}/`;
        const $ = await fetchDocument(url);

        const anime = {
            title: '',
            japanese_title: '',
            slug: slug,
            poster: '',
            rating: '',
            produser: '',
            type: '',
            status: '',
            episode_count: '',
            duration: '',
            release_date: '',
            studio: '',
            genres: [],
            synopsis: '',
            episode_lists: [],
            batch: null
        };

        // Parse title from main title
        const mainTitle = $('.entry-title').first().text().trim();
        anime.title = mainTitle.replace(/[Ss]ub\s+[Ii]ndo$/, '').trim();

        // Parse poster
        anime.poster = proxyImageUrl($('.infoanime .thumb img').attr('src'));

        // Parse rating
        const $rating = $('.archiveanime-rating span[itemprop="ratingValue"]');
        if ($rating.length > 0) {
            anime.rating = $rating.text().trim();
        }

        // Parse metadata from .spe spans
        $('.infoanime .spe span').each((i, el) => {
            const $el = $(el);
            const fullText = $el.text();

            if (fullText.includes('Japanese')) {
                anime.japanese_title = fullText.replace(/^.*Japanese\s+/, '').trim();
            } else if (fullText.includes('Synonyms')) {
                // Could parse synonyms if needed
            } else if (fullText.includes('Status')) {
                anime.status = fullText.replace(/^.*Status\s+/, '').trim();
            } else if (fullText.includes('Type')) {
                anime.type = fullText.replace(/^.*Type\s+/, '').trim();
            } else if (fullText.includes('Total Episode')) {
                anime.episode_count = fullText.replace(/^.*Total Episode\s+/, '').trim();
            } else if (fullText.includes('Duration')) {
                anime.duration = fullText.replace(/^.*Duration\s+/, '').trim();
            } else if (fullText.includes('Season')) {
                // If needed, could parse season
            } else if (fullText.includes('Studio')) {
                anime.studio = $el.find('a').text().trim();
            } else if (fullText.includes('Producers')) {
                const producers = [];
                $el.find('a').each((idx, a) => {
                    producers.push($(a).text().trim());
                });
                anime.produser = producers.join(', ');
            } else if (fullText.includes('Released:')) {
                anime.release_date = fullText.replace(/^.*Released:\s*/, '').trim();
            }
        });

        // Parse genres
        $('.infoanime .genre-info a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const name = $el.text().trim();

            if (name && href) {
                const slugMatch = href.match(/\/genre\/([^\/]+)/);
                anime.genres.push({
                    name: name,
                    slug: slugMatch ? slugMatch[1] : ''
                });
            }
        });

        // Parse synopsis - get only the first paragraph (main synopsis)
        const $synopsisDiv = $('.entry-content-single');
        if ($synopsisDiv.length > 0) {
            const synopsisText = $synopsisDiv.html();
            const $temp = cheerio.load(synopsisText);
            // Remove any unwanted elements like ads, etc.
            $temp('a, strong, b').each((i, el) => {
                const $el = $temp(el);
                $el.replaceWith($el.text());
            });
            anime.synopsis = $temp.text().trim();
        }

        // Parse episode list
        $('.lstepsiode.listeps ul li').each((i, el) => {
            const $el = $(el);
            const $episodeLink = $el.find('.epsright .eps a');
            const $titleLink = $el.find('.epsleft .lchx a');
            const episodeNumber = $episodeLink.text().trim();
            const episodeTitle = $titleLink.text().trim();
            const href = $titleLink.attr('href');
            const releaseDate = $el.find('.epsleft .date').text().trim();

            if (href) {
                const slugMatch = href.match(/\/([^\/]+)\/$/);
                const episodeSlug = slugMatch ? slugMatch[1] : '';

                anime.episode_lists.push({
                    episode_number: episodeNumber,
                    slug: episodeSlug,
                    title: episodeTitle,
                    release_date: releaseDate
                });
            }
        });

        return {
            status: 'success',
            data: anime
        };
    } catch (error) {
        console.error('Error scraping samehadaku anime detail:', error.message);
        throw error;
    }
}

// Scrape Episode Detail
async function scrapeEpisode(episodeSlug) {
    try {
        const url = `${BASE_URL}/${episodeSlug}/`;
        const $ = await fetchDocument(url);

        const episode = {
            title: $('.entry-title').text().trim(),
            slug: episodeSlug,
            anime_title: '',
            episode_number: '',
            default_stream_url: '',
            download_links: [],
            download_sections: [],
            prev_episode: null,
            next_episode: null,
            poster: '',
            release_time: '',
            description: '',
            anime_slug: '',
            post_id: '',
            stream_servers: []
        };

        const posterSrc = $('.cukder img').attr('src')
            || $('.episodeinf .thumb img').attr('src')
            || $('.player-area img').attr('src');
        episode.poster = posterSrc ? proxyImageUrl(posterSrc) : '';

        // Extract post id from article id attribute
        const articleId = $('article[id^="post-"]').attr('id');
        if (articleId) {
            const postMatch = articleId.match(/post-(\d+)/);
            if (postMatch) {
                episode.post_id = postMatch[1];
            }
        }

        // Extract episode number and anime title
        const titleMatch = episode.title.match(/^(.+?)\s+Episode\s+(\d+)/i);
        if (titleMatch) {
            episode.anime_title = titleMatch[1].trim();
            episode.episode_number = titleMatch[2];
        }

        // Extract release time / posted info
        const releaseInfo = $('.sbdbti .time-post').text().replace(/\s+/g, ' ').trim();
        if (releaseInfo) {
            episode.release_time = releaseInfo;
        }

        // Extract synopsis/description
        const descriptionHtml = $('.entry-content.entry-content-single').first();
        if (descriptionHtml.length > 0) {
            episode.description = descriptionHtml.text().replace(/\s+\n/g, '\n').trim();
        }

        // Extract anime slug from "All Episode" link
        const animeLink = $('.naveps .nvsc a').attr('href');
        if (animeLink) {
            const animeSlugMatch = animeLink.match(/\/anime\/([^\/]+)/);
            if (animeSlugMatch) {
                episode.anime_slug = animeSlugMatch[1];
            }
        }

        // Extract streaming server options (labels & ajax params)
        const playerOptions = [];
        $('.east_player_option').each((i, el) => {
            const $el = $(el);
            const option = {
                label: $el.text().trim(),
                post_id: $el.attr('data-post') || '',
                nume: $el.attr('data-nume') || '1',
                type: $el.attr('data-type') || 'schtml'
            };
            if (!episode.post_id && option.post_id) {
                episode.post_id = option.post_id;
            }
            playerOptions.push(option);
        });
        episode.stream_servers = playerOptions;

        // Extract default iframe URL (direct embed on page)
        const defaultIframe = $('.responsive-embed-stream iframe').attr('src');
        if (defaultIframe) {
            episode.default_stream_url = defaultIframe;
        }

        // Parse download sections (grouped by format)
        $('.download-eps').each((sectionIndex, sectionEl) => {
            const $section = $(sectionEl);
            const label = $section.find('p b').first().text().trim() || $section.find('p').first().text().trim();
            const entries = [];

            $section.find('ul li').each((i, el) => {
                const $el = $(el);
                const quality = $el.find('strong').text().trim();
                const size = $el.find('i').text().trim();
                const links = [];

                $el.find('a').each((j, a) => {
                    const $a = $(a);
                    const hostName = $a.text().trim();
                    const href = $a.attr('href');
                    if (hostName && href) {
                        links.push({
                            host: hostName,
                            url: href
                        });
                    }
                });

                if (quality && links.length > 0) {
                    const item = {
                        quality: quality,
                        size: size,
                        links: links
                    };
                    entries.push(item);
                    episode.download_links.push(item);
                }
            });

            if (entries.length > 0) {
                episode.download_sections.push({
                    label: label || `Format ${sectionIndex + 1}`,
                    items: entries
                });
            }
        });

        // Parse prev/next episode
        $('.flir a').each((i, el) => {
            const $link = $(el);
            const href = $link.attr('href');
            const text = $link.text().trim().toLowerCase();

            if (text.includes('prev') || text.includes('sebelum')) {
                const prevSlugMatch = href ? href.match(/\/([^\/]+)\/$/) : null;
                episode.prev_episode = prevSlugMatch ? prevSlugMatch[1] : '';
            } else if (text.includes('next') || text.includes('selanjutnya')) {
                const nextSlugMatch = href ? href.match(/\/([^\/]+)\/$/) : null;
                episode.next_episode = nextSlugMatch ? nextSlugMatch[1] : '';
            }
        });

        // Fallback: fetch iframe from admin-ajax when default still empty
        if ((!episode.default_stream_url) && episode.post_id) {
            const primaryOption = playerOptions[0] || null;
            const ajaxParams = {
                post: episode.post_id,
                nume: primaryOption ? primaryOption.nume : '1',
                type: primaryOption ? primaryOption.type : 'schtml'
            };
            try {
                const iframeSrc = await fetchAjaxPlayerIframe(ajaxParams);
                if (iframeSrc) {
                    episode.default_stream_url = iframeSrc;
                }
            } catch (error) {
                console.warn('Failed to fetch ajax player iframe:', error.message);
            }
        }

        return {
            status: 'success',
            data: episode
        };
    } catch (error) {
        console.error('Error scraping samehadaku episode:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeHome,
    scrapeAnimeDetail,
    scrapeEpisode
};
