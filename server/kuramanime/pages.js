const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { BASE_URL, BROWSER_EXECUTABLE_PATH, fetchWithPuppeteer, extractStreamingUrls, proxyImageUrl, extractSlug, extractAnimeId } = require('./helpers');

const DEFAULT_DETAIL_MAX_EPISODE_PAGES = 10;
const parsedDetailMaxEpisodePages = Number.parseInt(process.env.KURAMANIME_DETAIL_MAX_EPISODE_PAGES, 10);
const maxDetailEpisodePages = Number.isFinite(parsedDetailMaxEpisodePages)
    ? Math.min(50, Math.max(1, parsedDetailMaxEpisodePages))
    : DEFAULT_DETAIL_MAX_EPISODE_PAGES;

function extractEpisodeNumber(episodeHref = '', episodeTitle = '') {
    const match = String(episodeHref).match(/\/episode\/(\d+)/) || String(episodeTitle).match(/Episode\s+(\d+)/i);
    return match ? match[1] : null;
}

function createEpisodeItem(episodeHref, episodeTitle) {
    const episodeNum = extractEpisodeNumber(episodeHref, episodeTitle);
    return {
        title: episodeTitle,
        episode_num: episodeNum,
        url: episodeHref.startsWith('http') ? episodeHref : `${BASE_URL}${episodeHref}`
    };
}

function sortEpisodesByNumber(episodes = []) {
    return episodes.sort((a, b) => {
        const numA = Number(a.episode_num || extractEpisodeNumber(a.url, a.title) || 0);
        const numB = Number(b.episode_num || extractEpisodeNumber(b.url, b.title) || 0);
        return numA - numB;
    });
}

async function scrapeHome() {
    try {
        const data = await fetchWithPuppeteer(BASE_URL, { waitForSelector: '.product__item, #sliderSection' });
        const $ = cheerio.load(data);
        const result = {
            banner_rekomendasi: [],
            sedang_tayang: [],
            dilihat_terbanyak_musim_ini: [],
            komentar_terbaru_episode: [],
            selesai_tayang: [],
            film_layar_lebar: [],
            komentar_terbaru_anime: []
        };

        // 1. Banner Rekomendasi (8 items from hero slider)
        $('#sliderSection .hero__items').each((i, el) => {
            if (i >= 8) return false;
            const $el = $(el);
            const $heroText = $el.find('.hero__text');
            const title = $heroText.find('h2').text().trim();
            const description = $heroText.find('p').text().trim();
            const detailLink = $heroText.find('a[href*="/anime/"]').attr('href');
            const backgroundImage = $el.attr('data-setbg');

            const genres = [];
            $heroText.find('.label').each((j, genreEl) => {
                genres.push($(genreEl).text().trim());
            });

            if (title && detailLink) {
                result.banner_rekomendasi.push({
                    title: title,
                    description: description,
                    slug: extractSlug(detailLink),
                    anime_id: extractAnimeId(detailLink),
                    poster: proxyImageUrl(backgroundImage),
                    genres: genres,
                    url: detailLink.startsWith('http') ? detailLink : `${BASE_URL}${detailLink}`
                });
            }
        });

        // 2-4. Parse all trending sections
        $('.trending__product').each((sectionIdx, section) => {
            const $section = $(section);
            const sectionTitle = $section.find('.section-title h4, .section-title h5').first().text().trim();

            let targetArray = null;
            if (sectionTitle === 'Sedang Tayang') {
                targetArray = result.sedang_tayang;
            } else if (sectionTitle === 'Selesai Tayang') {
                targetArray = result.selesai_tayang;
            } else if (sectionTitle === 'Film Layar Lebar') {
                targetArray = result.film_layar_lebar;
            }

            if (targetArray) {
                $section.find('.product__item').each((i, el) => {
                    const $el = $(el);
                    const $link = $el.find('a').first();
                    const href = $link.attr('href');
                    const title = $el.find('h5 a, .product__item__text h5 a').first().text().trim();
                    const poster = $el.find('.product__item__pic').attr('data-setbg');
                    const episodeInfo = $el.find('.ep span').text().trim() || $el.find('.ep').text().trim();

                    const types = [];
                    $el.find('.product__item__text ul li').each((j, liEl) => {
                        const typeText = $(liEl).text().trim();
                        if (typeText) types.push(typeText);
                    });

                    const viewsText = $el.find('.fa-eye').next('span').text().trim();
                    const commentsText = $el.find('.fa-comments').next('span').text().trim();

                    if (title && href) {
                        targetArray.push({
                            title: title,
                            slug: extractSlug(href),
                            anime_id: extractAnimeId(href),
                            poster: proxyImageUrl(poster),
                            episode: episodeInfo,
                            type: types.length > 0 ? types.join(' ') : null,
                            views: viewsText && !viewsText.includes('Loading') ? viewsText : null,
                            comments: commentsText && !commentsText.includes('Loading') ? commentsText : null,
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                        });
                    }
                });
            }
        });

        // 5. Dilihat Terbanyak Musim Ini
        $('.product__sidebar__view').each((i, sidebar) => {
            const $sidebar = $(sidebar);
            const sidebarTitle = $sidebar.find('h5, h4').first().text().trim();

            if (sidebarTitle.includes('Dilihat Terbanyak')) {
                $sidebar.find('.product__sidebar__view__item').each((j, el) => {
                    const $el = $(el);
                    const $link = $el.closest('a').length > 0 ? $el.closest('a') : $el.find('a');
                    const href = $link.attr('href');
                    const title = $el.find('h5').text().trim();
                    const poster = $el.parent().attr('data-setbg') || $el.parent().find('[data-setbg]').first().attr('data-setbg');
                    const rating = $el.find('.ep').text().trim();
                    const viewsText = $el.find('.view').text().trim();

                    if (title && href) {
                        result.dilihat_terbanyak_musim_ini.push({
                            title: title,
                            slug: extractSlug(href),
                            anime_id: extractAnimeId(href),
                            poster: proxyImageUrl(poster),
                            rating: rating || null,
                            views: viewsText && !viewsText.includes('Loading') ? viewsText : null,
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                        });
                    }
                });
            }
        });

        // 6. Komentar Terbaru
        $('.product__sidebar__view').each((sectionIdx, sidebar) => {
            const $sidebar = $(sidebar);
            const sidebarTitle = $sidebar.find('.section-title h5, .section-title h4, h5, h4').first().text().trim();

            if (sidebarTitle.includes('Komentar')) {
                const isEpisode = sidebarTitle.includes('Episode');
                const targetArray = isEpisode ? result.komentar_terbaru_episode : result.komentar_terbaru_anime;

                $sidebar.find('.product__sidebar__comment__item').each((i, el) => {
                    const $el = $(el);
                    const $link = $el.find('a').first();
                    const href = $link.attr('href');
                    const poster = $el.find('.product__sidebar__comment__item__pic').attr('data-setbg');
                    const title = $el.find('h5, a h5').first().text().trim();

                    const infoText = $el.find('span').text().trim();
                    const episodeMatch = infoText.match(/Episode (\d+)/);
                    const userMatch = infoText.match(/oleh (.+?)\)/);
                    const timeMatch = infoText.match(/Dikomentari\s+(.+?)\s+oleh/);

                    const episodeInfo = episodeMatch ? `Episode ${episodeMatch[1]}` : '';
                    const username = userMatch ? userMatch[1].trim() : '';
                    const timeAgo = timeMatch ? timeMatch[1].trim() : '';

                    if (title && href) {
                        const animeId = extractAnimeId(href);
                        const slug = extractSlug(href);

                        const item = {
                            title: title,
                            username: username,
                            time_ago: timeAgo,
                            poster: proxyImageUrl(poster),
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                            anime_id: animeId,
                            slug: slug
                        };

                        if (isEpisode && episodeInfo) {
                            item.episode_info = episodeInfo;
                            const episodeNumMatch = episodeInfo.match(/Episode (\d+)/);
                            if (episodeNumMatch) {
                                item.episode_num = episodeNumMatch[1];
                            }
                        }

                        targetArray.push(item);
                    }
                });
            }
        });

        return result;
    } catch (error) {
        console.error('Kuramanime scrapeHome error:', error.message);
        throw error;
    }
}

async function scrapeDetail(animeId, slug) {
    try {
        const url = `${BASE_URL}/anime/${animeId}/${slug}`;
        const data = await fetchWithPuppeteer(url, { waitForSelector: '.anime__details__title, .anime__details__pic' });
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

        result.title = $('.anime__details__title h3').text().trim();
        result.poster = proxyImageUrl($('.anime__details__pic').attr('data-setbg'));
        result.synopsis = $('.anime__details__text p').text().trim();

        $('.anime__details__widget ul li').each((i, el) => {
            const $el = $(el);
            const label = $el.find('.col-3 span').text().trim().replace(':', '');
            const $valueCol = $el.find('.col-9');
            let value = $valueCol.find('a').text().trim();
            if (!value) {
                value = $valueCol.text().trim();
            }

            if (label && value) {
                result.info[label.toLowerCase().replace(/\s+/g, '_')] = value;
            }
            
            // Extract genres from Genre info item specifically
            if (label && label.toLowerCase() === 'genre') {
                $valueCol.find('a').each((j, genreEl) => {
                    const genre = $(genreEl).text().trim().replace(/,$/, '');
                    if (genre) result.genres.push(genre);
                });
            }
        });

        // Episodes dari popover dengan pagination support
        const $episodeBtn = $('#episodeLists');
        if ($episodeBtn.length > 0) {
            const popoverContent = $episodeBtn.attr('data-content');
            if (popoverContent) {
                // Scrape episodes from first page popover
                const $popover = cheerio.load(popoverContent);

                // Track episode numbers to avoid duplicates
                const episodeNumbers = new Set();

                $popover('a[href*="/episode/"]').each((i, el) => {
                    const $el = $popover(el);
                    const episodeHref = $el.attr('href');
                    const episodeTitle = $el.text().trim();

                    if (episodeHref && episodeTitle) {
                        // Extract episode number for deduplication
                        const epMatch = episodeHref.match(/\/episode\/(\d+)/);
                        const epNum = epMatch ? epMatch[1] : null;

                        if (epNum && !episodeNumbers.has(epNum)) {
                            episodeNumbers.add(epNum);
                            result.episodes.push(createEpisodeItem(episodeHref, episodeTitle));
                        }
                    }
                });

                // Check for pagination in popover
                const nextPageLink = $popover('.page__link__episode').attr('href');
                if (nextPageLink) {
                    console.log(`[Detail] Found episode pagination, fetching additional pages...`);

                    let currentPage = 2;
                    let hasMorePages = true;
                    let currentUrl = nextPageLink.startsWith('http') ? nextPageLink : `${BASE_URL}${nextPageLink}`;

                    while (hasMorePages && currentPage <= maxDetailEpisodePages) {
                        try {
                            console.log(`[Detail] Fetching page ${currentPage}: ${currentUrl}`);
                            const pageData = await fetchWithPuppeteer(currentUrl);

                            const $page = cheerio.load(pageData);
                            const $pageEpisodeBtn = $page('#episodeLists');

                            if ($pageEpisodeBtn.length > 0) {
                                const pagePopoverContent = $pageEpisodeBtn.attr('data-content');
                                if (pagePopoverContent) {
                                    const $pagePopover = cheerio.load(pagePopoverContent);
                                    let episodesOnPage = 0;

                                    $pagePopover('a[href*="/episode/"]').each((i, el) => {
                                        const $el = $pagePopover(el);
                                        const episodeHref = $el.attr('href');
                                        const episodeTitle = $el.text().trim();

                                        if (episodeHref && episodeTitle) {
                                            const epMatch = episodeHref.match(/\/episode\/(\d+)/);
                                            const epNum = epMatch ? epMatch[1] : null;

                                            if (epNum && !episodeNumbers.has(epNum)) {
                                                episodeNumbers.add(epNum);
                                                result.episodes.push(createEpisodeItem(episodeHref, episodeTitle));
                                                episodesOnPage++;
                                            }
                                        }
                                    });

                                    console.log(`[Detail] Found ${episodesOnPage} episodes on page ${currentPage}, total: ${result.episodes.length}`);

                                    // Check for next page
                                    const nextLink = $pagePopover('.page__link__episode').attr('href');
                                    if (nextLink && episodesOnPage > 0) {
                                        currentUrl = nextLink.startsWith('http') ? nextLink : `${BASE_URL}${nextLink}`;
                                        currentPage++;
                                    } else {
                                        hasMorePages = false;
                                    }
                                } else {
                                    hasMorePages = false;
                                }
                            } else {
                                hasMorePages = false;
                            }
                        } catch (pageError) {
                            console.warn(`[Detail] Error fetching page ${currentPage}:`, pageError.message);
                            hasMorePages = false;
                        }
                    }

                    if (hasMorePages && currentPage > maxDetailEpisodePages) {
                        console.log(`[Detail] Reached max episode pages limit: ${maxDetailEpisodePages}`);
                    }
                }
            }
        }

        // Fallback
        if (result.episodes.length === 0) {
            $('.anime__details__episodes a').each((i, el) => {
                const $el = $(el);
                const episodeHref = $el.attr('href');
                const episodeTitle = $el.text().trim();

                if (episodeHref && episodeTitle) {
                    result.episodes.push(createEpisodeItem(episodeHref, episodeTitle));
                }
            });
        }

        // Batch downloads
        const $batchBtn = $('#episodeBatchLists');
        if ($batchBtn.length > 0) {
            const batchPopoverContent = $batchBtn.attr('data-content');
            if (batchPopoverContent) {
                const $batchPopover = cheerio.load(batchPopoverContent);
                $batchPopover('a[href*="/batch/"]').each((i, el) => {
                    const $el = $batchPopover(el);
                    const batchHref = $el.attr('href');
                    const batchTitle = $el.text().trim().replace(/\s+/g, ' ');

                    if (batchHref && batchTitle) {
                        const batchRangeMatch = batchHref.match(/\/batch\/([^\\/]+)$/);
                        const batchRange = batchRangeMatch ? batchRangeMatch[1] : '';

                        result.batch_list.push({
                            title: batchTitle,
                            range: batchRange,
                            url: batchHref.startsWith('http') ? batchHref : `${BASE_URL}${batchHref}`
                        });
                    }
                });
            }
        }

        // Anime Lainnya
        $('.anime__details__sidebar').each((i, sidebar) => {
            const $sidebar = $(sidebar);
            const sectionTitle = $sidebar.find('.section-title h5, .section-title h4').text().trim();

            if (sectionTitle === 'Anime Lainnya') {
                $sidebar.find('#randomList a[href*="/anime/"]').each((j, el) => {
                    const $link = $(el);
                    const href = $link.attr('href');
                    const $item = $link.find('.product__sidebar__view__item');
                    const poster = $item.attr('data-setbg');
                    const title = $item.find('h5').text().trim();
                    const rating = $item.find('.ep').text().trim().replace(/\s+/g, ' ');
                    const quality = $item.find('.view').text().trim();

                    if (title && href) {
                        result.anime_lainnya.push({
                            title: title,
                            slug: extractSlug(href),
                            anime_id: extractAnimeId(href),
                            poster: proxyImageUrl(poster),
                            rating: rating || null,
                            quality: quality || null,
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                        });
                    }
                });
            }
        });

        sortEpisodesByNumber(result.episodes);
        return result;
    } catch (error) {
        console.error('Kuramanime scrapeDetail error:', error.message);
        throw error;
    }
}

async function scrapeEpisode(animeId, slug, episodeNum) {
    let browser;
    try {
        const url = `${BASE_URL}/anime/${animeId}/${slug}/episode/${episodeNum}`;

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: BROWSER_EXECUTABLE_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        try {
            await page.waitForFunction(
                () => {
                    const downloadSection = document.querySelector('#animeDownloadLink');
                    if (!downloadSection) return false;
                    const links = downloadSection.querySelectorAll('a[href]');
                    return links.length > 0;
                },
                { timeout: 15000 }
            );
        } catch (waitError) {
            console.warn('Download links did not load within timeout');
        }

        const data = await page.content();
        const videoSources = await extractStreamingUrls(page, url, animeId, slug, episodeNum);

        await browser.close();
        browser = null;

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
            }
        };

        result.anime_title = $('.breadcrumb__links a[href*="/anime/"]').last().text().trim();

        const episodeTitleFull = $('#episodeTitle').text().trim();
        result.title = episodeTitleFull || $('.anime__video__player h5').first().text().trim();

        const animeDetailLink = $('.episode__navigations .center__nav').attr('href');
        if (animeDetailLink) {
            result.anime_detail_url = animeDetailLink.startsWith('http') ? animeDetailLink : `${BASE_URL}${animeDetailLink}`;
        }

        $('.anime__details__episodes #animeEpisodes a.ep-button').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const episodeText = $el.text().trim();
            const isActive = $el.hasClass('active-ep');

            const epMatch = episodeText.match(/Ep\s*(\d+)/i);
            const epNum = epMatch ? epMatch[1] : '';

            const hasFireIcon = $el.find('.fa-fire').length > 0;

            if (href && episodeText) {
                result.episode_list.push({
                    episode: epNum,
                    title: episodeText,
                    url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                    is_active: isActive,
                    is_new: hasFireIcon
                });
            }
        });

        const currentServerText = $('.anime__video__player h5 .text-danger, h5 .text-danger').first().text().trim();
        result.current_server = currentServerText || 'BGlobal';

        $('#changeServer option').each((i, el) => {
            const $el = $(el);
            const value = $el.attr('value');
            const text = $el.text().trim();
            const isSelected = $el.attr('selected') !== undefined;

            if (value && text) {
                result.streaming_servers.push({
                    value: value,
                    name: text,
                    selected: isSelected,
                    sources: []
                });
            }
        });

        const $downloadSection = $('#animeDownloadLink');
        if ($downloadSection.length > 0) {
            let currentQuality = '';
            let currentSize = '';
            let currentFormat = '';

            $downloadSection.children().each((i, el) => {
                const $el = $(el);

                if ($el.is('h6')) {
                    const headerText = $el.text().trim();

                    const formatMatch = headerText.match(/^(MKV|MP4)/i);
                    currentFormat = formatMatch ? formatMatch[1].toUpperCase() : '';

                    const qualityMatch = headerText.match(/(\d+p)/i);
                    currentQuality = qualityMatch ? qualityMatch[1] : '';

                    const subType = headerText.match(/\((Softsub|Hardsub)\)/i);
                    const subTypeStr = subType ? subType[1] : '';

                    const sizeMatch = headerText.match(/—\s*\(([^)]+)\)/);
                    currentSize = sizeMatch ? sizeMatch[1].trim() : '';

                    currentQuality = `${currentFormat} ${currentQuality}${subTypeStr ? ' (' + subTypeStr + ')' : ''}`.trim();
                } else if ($el.is('a')) {
                    const href = $el.attr('href');
                    const linkText = $el.text().trim();

                    if (href && linkText) {
                        result.download_links.push({
                            quality: currentQuality,
                            size: currentSize,
                            provider: linkText,
                            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
                        });
                    }
                }
            });
        }

        $('.episode__navigations a').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const text = $el.text().trim().toLowerCase();

            if (href && href.includes('/episode/')) {
                if (text.includes('sebelumnya') || text.includes('prev') || text.includes('previous')) {
                    result.navigation.prev_episode = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                } else if (text.includes('selanjutnya') || text.includes('next')) {
                    result.navigation.next_episode = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                }
            }
        });

        result.iframe_url = null;
        const $iframe = $('iframe#animeVideoPlayer, iframe.anime-player, iframe[src*="kuramadrive"], iframe[src*="filemoon"]').first();
        if ($iframe.length > 0) {
            result.iframe_url = $iframe.attr('src');
        }

        if (videoSources && videoSources.servers) {
            result.streaming_servers.forEach(server => {
                const serverSources = videoSources.servers[server.value];
                if (serverSources && serverSources.length > 0) {
                    server.sources = serverSources;
                }
            });
        }

        return result;
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        console.error('Kuramanime scrapeEpisode error:', error.message);
        throw error;
    }
}

async function scrapeBatch(animeId, slug, batchRange) {
    let browser;
    try {
        const url = `${BASE_URL}/anime/${animeId}/${slug}/batch/${batchRange}`;

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: BROWSER_EXECUTABLE_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const html = await page.content();
        const $ = cheerio.load(html);

        const result = {
            title: '',
            poster: '',
            synopsis: '',
            info: {},
            genres: [],
            download_links: []
        };

        result.title = $('#episodeTitle').text().trim().replace('[BATCH]', '').trim();
        if (!result.title) {
            result.title = $('.anime__details__title h3').text().trim().replace('[BATCH]', '').trim();
        }

        result.poster = proxyImageUrl($('.anime__details__pic').attr('data-setbg'));
        result.synopsis = $('.anime__details__text p').text().trim();

        $('.anime__details__widget ul li').each((i, el) => {
            const $el = $(el);
            const label = $el.find('.col-3 span').text().trim().replace(':', '');
            const $valueCol = $el.find('.col-9');
            let value = $valueCol.find('a').text().trim();
            if (!value) {
                value = $valueCol.text().trim();
            }

            if (label && value) {
                result.info[label.toLowerCase().replace(/\s+/g, '_')] = value;
            }
            
            // Extract genres from Genre info item specifically
            if (label && label.toLowerCase() === 'genre') {
                $valueCol.find('a').each((j, genreEl) => {
                    const genre = $(genreEl).text().trim().replace(/,$/, '');
                    if (genre) result.genres.push(genre);
                });
            }
        });

        // Extract data-kk
        const dataKk = $('[data-kk]').attr('data-kk');
        if (!dataKk) {
            console.warn('data-kk attribute not found in batch page');
            await browser.close();
            return result;
        }

        console.log(`[Batch] Found data-kk: ${dataKk}`);

        const jsUrl = `${BASE_URL}/assets/js/${dataKk}.js`;
        const jsResponse = await axios.get(jsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            }
        });

        const jsContent = jsResponse.data;
        const envMatch = jsContent.match(/window\.process\s*=\s*{\s*env:\s*({[^}]+})/);
        if (!envMatch) {
            console.warn('Could not parse environment variables from JS');
            await browser.close();
            return result;
        }

        const envVars = {};
        const envContent = envMatch[1];
        const varMatches = envContent.matchAll(/(\w+):\s*['\"]([^'\"]+)['\"]/g);
        for (const match of varMatches) {
            envVars[match[1]] = match[2];
        }

        console.log('[Batch] Parsed env vars:', Object.keys(envVars));

        const authTokenUrl = `${BASE_URL}/${envVars.MIX_PREFIX_AUTH_ROUTE_PARAM || 'assets/'}${envVars.MIX_AUTH_ROUTE_PARAM}`;
        const tokenResponse = await axios.get(authTokenUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            }
        });

        const authToken = tokenResponse.data.trim();
        console.log('[Batch] Auth token obtained');

        const pageTokenKey = envVars.MIX_PAGE_TOKEN_KEY;
        const serverKey = envVars.MIX_STREAM_SERVER_KEY;
        const batchUrl = `${url}?${pageTokenKey}=${authToken}&${serverKey}=kuramadrive&page=1`;

        console.log('[Batch] Fetching download links from:', batchUrl);

        await page.goto(batchUrl, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        await page.waitForSelector('#animeDownloadLink', { timeout: 15000 });
        const batchHtml = await page.$eval('#animeDownloadLink', el => el.outerHTML);
        const $batch = cheerio.load(batchHtml);
        let currentQuality = 'Unknown';
        let currentSize = '';

        $batch('#animeDownloadLink > *').each((i, el) => {
            const $el = $batch(el);

            if ($el.is('h6') || $el.is('p') || $el.is('h4') || $el.is('h5') || $el.hasClass('download-header')) {
                const headerText = $el.text().trim();

                const formatMatch = headerText.match(/(MKV|MP4|AVI)/i);
                const currentFormat = formatMatch ? formatMatch[1].toUpperCase() : '';

                const resolutionMatch = headerText.match(/(\d+p)/i);
                const resolution = resolutionMatch ? resolutionMatch[1] : '';

                const subType = headerText.match(/\((Softsub|Hardsub)\)/i);
                const subTypeStr = subType ? subType[1] : '';

                const sizeMatch = headerText.match(/—\s*\(([^)]+)\)/);
                currentSize = sizeMatch ? sizeMatch[1].trim() : '';

                if (currentFormat && resolution) {
                    currentQuality = `${currentFormat} ${resolution}${subTypeStr ? ' (' + subTypeStr + ')' : ''}${currentSize ? ' ' + currentSize : ''}`.trim();
                    console.log(`[Batch] Found quality: ${currentQuality}`);
                }
            } else if ($el.is('a')) {
                const href = $el.attr('href');
                const linkText = $el.text().trim();

                if (href && linkText && href.startsWith('http') &&
                    !linkText.toLowerCase().includes('loading') &&
                    !linkText.toLowerCase().includes('sebentar')) {
                    result.download_links.push({
                        quality: currentQuality,
                        provider: linkText,
                        url: href
                    });
                }
            }
        });

        console.log(`[Batch] Extracted ${result.download_links.length} download links`);

        await browser.close();
        browser = null;

        return result;
    } catch (error) {
        console.error('Kuramanime scrapeBatch error:', error.message);
        if (browser) {
            await browser.close();
        }
        throw error;
    }
}

module.exports = {
    scrapeHome,
    scrapeDetail,
    scrapeEpisode,
    scrapeBatch
};
