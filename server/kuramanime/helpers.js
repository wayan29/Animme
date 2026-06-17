const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const BASE_URL = 'https://v18.kuramanime.ing';
const BROWSER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.KURAMANIME_CHROMIUM_PATH || '/snap/bin/chromium';
const TERTUYUL_API_KEY = process.env.TERTUYUL_API_KEY || '';
const TERTUYUL_PROXY = process.env.TERTUYUL_PROXY || '';
const TERTUYUL_IN_URL = process.env.TERTUYUL_IN_URL || 'http://api.tertuyul.my.id/in.php';
const TERTUYUL_RES_URL = process.env.TERTUYUL_RES_URL || 'http://api.tertuyul.my.id/res.php';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseClearanceResponse(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const separatorIndex = value.indexOf(':');
    if (separatorIndex === -1) {
        return null;
    }

    const cfClearance = value.slice(0, separatorIndex).trim();
    const userAgent = value.slice(separatorIndex + 1).trim();

    if (!cfClearance || !userAgent) {
        return null;
    }

    return { cfClearance, userAgent };
}

async function solveCloudflareWithTertuyul(pageUrl) {
    if (!TERTUYUL_API_KEY || !TERTUYUL_PROXY) {
        return null;
    }

    console.log('[Tertuyul] Requesting Cloudflare fallback token...');

    const submitPayload = new URLSearchParams({
        key: TERTUYUL_API_KEY,
        method: 'cloudflare',
        pageurl: pageUrl,
        proxy: TERTUYUL_PROXY,
        json: '1'
    });

    const submitResponse = await axios.post(TERTUYUL_IN_URL, submitPayload.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
    });

    const task = submitResponse.data;
    if (!task || task.status !== 1 || !task.request) {
        throw new Error(`Tertuyul submit failed: ${task?.request || 'unknown error'}`);
    }

    for (let attempt = 1; attempt <= 12; attempt++) {
        await sleep(5000);

        const resultPayload = new URLSearchParams({
            key: TERTUYUL_API_KEY,
            action: 'get',
            id: String(task.request),
            json: '1'
        });

        const resultResponse = await axios.post(TERTUYUL_RES_URL, resultPayload.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000
        });

        const result = resultResponse.data;
        if (result?.status === 1 && result.request) {
            const parsed = parseClearanceResponse(result.request);
            if (!parsed) {
                throw new Error('Tertuyul returned invalid cf_clearance payload');
            }
            console.log('[Tertuyul] Cloudflare fallback token ready');
            return parsed;
        }

        if (result?.request !== 'CAPCHA_NOT_READY') {
            throw new Error(`Tertuyul poll failed: ${result?.request || 'unknown error'}`);
        }
    }

    throw new Error('Tertuyul timeout waiting for Cloudflare token');
}

async function fetchWithTertuyulFallback(url, options = {}) {
    const { waitForSelector = '.product__item', timeout = 60000 } = options;
    const solved = await solveCloudflareWithTertuyul(url);

    if (!solved) {
        throw new Error('Tertuyul credentials are not configured');
    }

    const response = await axios.get(url, {
        headers: {
            'User-Agent': solved.userAgent,
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Cookie': `cf_clearance=${solved.cfClearance}`
        },
        timeout
    });

    const html = response.data;
    if (waitForSelector) {
        const $ = cheerio.load(html);
        if (!$(waitForSelector.split(',').map(selector => selector.trim()).join(', ')).length) {
            console.warn(`[Tertuyul] Selector ${waitForSelector} not found after fallback fetch`);
        }
    }

    return html;
}

function inferQualityFromUrl(url = '') {
    const match = url.match(/(?:^|[^\d])(360|480|720|1080|1440|2160)p(?:[^\d]|$)/i);
    return match ? `${match[1]}p` : null;
}

function normalizeStreamingSource(source) {
    if (!source?.url) {
        return null;
    }

    const inferredQuality = inferQualityFromUrl(source.url);
    const normalizedQuality = source.quality && source.quality !== 'unknown'
        ? source.quality
        : (inferredQuality || 'unknown');

    return {
        quality: normalizedQuality,
        type: source.type || 'video/mp4',
        url: source.url
    };
}

function sanitizeStreamingSources(sources = []) {
    const normalizedSources = sources
        .map(normalizeStreamingSource)
        .filter(Boolean);

    const preferredByUrl = new Map();

    for (const source of normalizedSources) {
        const key = `${source.url}|${source.type}`;
        const existing = preferredByUrl.get(key);

        if (!existing) {
            preferredByUrl.set(key, source);
            continue;
        }

        if (existing.quality === 'unknown' && source.quality !== 'unknown') {
            preferredByUrl.set(key, source);
        }
    }

    return Array.from(preferredByUrl.values()).sort((a, b) => {
        const qualityA = parseInt(a.quality, 10) || 999;
        const qualityB = parseInt(b.quality, 10) || 999;
        return qualityA - qualityB;
    });
}

// Shared function to fetch page content with Cloudflare bypass
async function fetchWithPuppeteer(url, options = {}) {
    const { waitForSelector = '.product__item', timeout = 60000, retries = 2 } = options;
    let browser;
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: BROWSER_EXECUTABLE_PATH,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled'
                ]
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            });

            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: timeout
            });

            // Wait for Cloudflare challenge to complete
            const title = await page.title();
            if (title.includes('Just a moment')) {
                console.log(`[Puppeteer] Cloudflare challenge detected on attempt ${attempt}, waiting...`);
                await new Promise(r => setTimeout(r, 8000));
                
                // Try to wait for content
                try {
                    await page.waitForSelector(waitForSelector, { timeout: 15000 });
                } catch (e) {
                    // Check title again
                    const newTitle = await page.title();
                    if (newTitle.includes('Just a moment')) {
                        throw new Error('Cloudflare challenge not resolved');
                    }
                }
            } else {
                // Normal page, wait for content
                try {
                    await page.waitForSelector(waitForSelector, { timeout: 10000 });
                } catch (e) {
                    console.log(`[Puppeteer] Selector ${waitForSelector} not found, continuing anyway`);
                }
            }

            const data = await page.content();
            await browser.close();
            return data;
        } catch (error) {
            lastError = error;
            console.error(`[Puppeteer] Attempt ${attempt} failed:`, error.message);
            if (browser) {
                await browser.close();
            }
            if (attempt < retries) {
                console.log(`[Puppeteer] Retrying in 3 seconds...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
    
    if (TERTUYUL_API_KEY && TERTUYUL_PROXY) {
        console.log('[Puppeteer] Falling back to Tertuyul Cloudflare solver');
        return fetchWithTertuyulFallback(url, options);
    }

    throw lastError || new Error('All fetch attempts failed');
}

// Helper function to extract streaming URLs from specific server
async function extractStreamingUrlsForServer(url, authToken, pageTokenKey, serverKey, serverName) {
    try {
        const videoPageUrl = `${url}?${pageTokenKey}=${authToken}&${serverKey}=${serverName}&page=1`;

        const videoResponse = await axios.get(videoPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            },
            timeout: 10000
        });

        const $video = cheerio.load(videoResponse.data);
        const sources = [];

        // Try to extract from video sources
        $video('video source').each((i, el) => {
            const src = $video(el).attr('src');
            const quality = $video(el).attr('size');
            const type = $video(el).attr('type');

            if (src) {
                sources.push({
                    quality: quality ? `${quality}p` : 'unknown',
                    type: type || 'video/mp4',
                    url: src
                });
            }
        });

        // If no sources, try to extract iframe
        if (sources.length === 0) {
            const iframe = $video('iframe').first().attr('src');
            if (iframe) {
                sources.push({
                    quality: 'iframe',
                    type: 'text/html',
                    url: iframe
                });
            }
        }

        return sanitizeStreamingSources(sources);
    } catch (error) {
        console.warn(`Failed to extract from ${serverName}:`, error.message);
        return [];
    }
}

async function extractStreamingUrlsFromPage(page, serverName) {
    const playerData = await page.evaluate(() => {
        const player = document.querySelector('#player');
        const animeVideoPlayer = document.querySelector('#animeVideoPlayer');

        if (!player && !animeVideoPlayer) {
            return null;
        }

        const sources = [];

        if (player) {
            const directSrc = player.getAttribute('src');
            const directSize = player.getAttribute('size') || player.dataset?.quality || '';
            if (directSrc) {
                sources.push({
                    quality: directSize ? `${directSize}p` : 'unknown',
                    type: 'video/mp4',
                    url: directSrc
                });
            }

            player.querySelectorAll('source').forEach((source) => {
                const src = source.getAttribute('src');
                const size = source.getAttribute('size');
                const type = source.getAttribute('type');

                if (src) {
                    sources.push({
                        quality: size ? `${size}p` : 'unknown',
                        type: type || 'video/mp4',
                        url: src
                    });
                }
            });
        }

        if (sources.length === 0 && animeVideoPlayer) {
            const iframe = animeVideoPlayer.querySelector('iframe');
            if (iframe?.src) {
                sources.push({
                    quality: 'iframe',
                    type: 'text/html',
                    url: iframe.src
                });
            }
        }

        return sources;
    });

    const uniqueSources = sanitizeStreamingSources(playerData || []);

    if (uniqueSources.length > 0) {
        console.log(`  ✓ ${serverName}: ${uniqueSources.length} source(s) from rendered DOM`);
    }

    return uniqueSources;
}

// Helper function to extract streaming URLs from all servers
async function extractStreamingUrls(page, url, animeId, slug, episodeNum) {
    try {
        const html = await page.content();
        const $ = cheerio.load(html);

        // Step 1: Extract data-kk attribute
        const dataKk = $('[data-kk]').attr('data-kk');
        if (!dataKk) {
            console.warn('data-kk attribute not found');
            return null;
        }

        console.log(`Found data-kk: ${dataKk}`);

        // Step 2: Fetch JS file to get environment variables
        const jsUrl = `${BASE_URL}/assets/js/${dataKk}.js`;
        const jsResponse = await axios.get(jsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            }
        });

        // Step 3: Parse environment variables from JS
        const jsContent = jsResponse.data;
        const envMatch = jsContent.match(/window\.process\s*=\s*{\s*env:\s*({[^}]+})/);
        if (!envMatch) {
            console.warn('Could not parse environment variables from JS');
            return null;
        }

        // Extract env variables
        const envVars = {};
        const envContent = envMatch[1];
        const varMatches = envContent.matchAll(/(\w+):\s*['\"]([^'\"]+)['\"]/g);
        for (const match of varMatches) {
            envVars[match[1]] = match[2];
        }

        console.log('Parsed env vars:', Object.keys(envVars));

        // Step 4: Fetch auth token
        const authTokenUrl = `${BASE_URL}/${envVars.MIX_PREFIX_AUTH_ROUTE_PARAM || 'assets/'}${envVars.MIX_AUTH_ROUTE_PARAM}`;
        const tokenResponse = await axios.get(authTokenUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url
            }
        });

        const authToken = tokenResponse.data.trim();
        console.log('Auth token obtained');

        // Step 5: Extract from all available servers
        const pageTokenKey = envVars.MIX_PAGE_TOKEN_KEY;
        const serverKey = envVars.MIX_STREAM_SERVER_KEY;

        // Only extract from kuramadrive (HLS source)
        const serverResults = {};

        console.log('Extracting video sources from kuramadrive...');

        let sources = await extractStreamingUrlsForServer(
            url, authToken, pageTokenKey, serverKey, 'kuramadrive'
        );

        if (sources.length === 0) {
            console.log('  … retrying kuramadrive extraction from rendered DOM');

            const videoPageUrl = `${url}?${pageTokenKey}=${authToken}&${serverKey}=kuramadrive&page=1`;
            await page.goto(videoPageUrl, {
                waitUntil: 'networkidle2',
                timeout: 45000
            });

            try {
                await page.waitForFunction(
                    () => {
                        const player = document.querySelector('#player');
                        const animeVideoPlayer = document.querySelector('#animeVideoPlayer');
                        return Boolean(
                            player?.querySelector('source') ||
                            player?.getAttribute('src') ||
                            animeVideoPlayer?.querySelector('iframe')
                        );
                    },
                    { timeout: 15000 }
                );
            } catch (error) {
                console.warn('Rendered DOM source wait timed out for kuramadrive');
            }

            sources = await extractStreamingUrlsFromPage(page, 'kuramadrive');
        }

        if (sources.length > 0) {
            serverResults['kuramadrive'] = sources;
            console.log(`  ✓ kuramadrive: ${sources.length} source(s)`);
        } else {
            console.log(`  ✗ kuramadrive: no sources`);
        }

        return {
            servers: serverResults,
            default_server: 'kuramadrive',
            auth_info: {
                data_kk: dataKk,
                page_token_key: pageTokenKey,
                server_key: serverKey
            }
        };

    } catch (error) {
        console.error('Error extracting streaming URLs:', error.message);
        console.error('Stack:', error.stack);
        return null;
    }
}

function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

const imageUrlMap = new Map();

function proxyImageUrl(url) {
    if (!url || !url.startsWith('http')) return url;
    const hash = getImageHash(url);
    imageUrlMap.set(hash, url);
    return `/img/${hash}`;
}

function getImageUrlMap() {
    return imageUrlMap;
}

function extractSlug(url) {
    if (!url) return '';
    const match = url.match(/\/anime\/(\d+)\/([^\/]+)/);
    return match ? match[2] : '';
}

function extractAnimeId(url) {
    if (!url) return '';
    const match = url.match(/\/anime\/(\d+)\//);
    return match ? match[1] : '';
}

module.exports = {
    fetchWithPuppeteer,
    extractStreamingUrls,
    extractStreamingUrlsForServer,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    extractAnimeId,
    BASE_URL,
    BROWSER_EXECUTABLE_PATH
};
