const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';

const BASE_URL = 'https://v2.samehadaku.how';
const PLAYER_AJAX_URL = `${BASE_URL}/wp-admin/admin-ajax.php`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

// Helper untuk generate hash dari URL gambar
function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

// Helper untuk store image URL mapping
const imageUrlMap = new Map();

function proxyImageUrl(url) {
    if (!url || !url.startsWith('http')) return url;
    const hash = getImageHash(url);
    imageUrlMap.set(hash, url);
    return `/img/${hash}`;
}

// Get Image URL Map (untuk server.js akses)
function getImageUrlMap() {
    return imageUrlMap;
}

// Extract slug from URL
function extractSlug(url) {
    if (!url) return '';
    const match = url.match(/\/anime\/([^\/]+)/);
    return match ? match[1] : '';
}

function isCloudflareChallenge(html = '') {
    if (!html || typeof html !== 'string') return false;
    return html.includes('Just a moment...')
        || html.includes('challenge-error-text')
        || html.includes('Enable JavaScript and cookies to continue');
}

async function fetchPageHtml(url, waitUntil = 'networkidle2') {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: CHROMIUM_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
        });

        await page.goto(url, { waitUntil, timeout: 120000 });
        const html = await page.content();

        if (isCloudflareChallenge(html)) {
            throw new Error(`Cloudflare challenge still active for ${url}`);
        }

        return html;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function fetchDocument(url, options = {}) {
    const headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': BASE_URL,
        ...(options.headers || {})
    };

    try {
        const response = await axios.get(url, {
            headers,
            timeout: options.timeout || 30000,
            validateStatus: () => true
        });

        if (response.status === 403 || isCloudflareChallenge(response.data)) {
            const html = await fetchPageHtml(url, options.waitUntil);
            return cheerio.load(html);
        }

        if (response.status >= 400) {
            throw new Error(`Request failed with status code ${response.status}`);
        }

        return cheerio.load(response.data);
    } catch (error) {
        if (error.message.includes('Cloudflare challenge')) {
            const html = await fetchPageHtml(url, options.waitUntil);
            return cheerio.load(html);
        }
        throw error;
    }
}

async function fetchAjaxPlayerIframe({ post, nume = '1', type = 'schtml' }) {
    if (!post) return null;
    const payload = new URLSearchParams({
        action: 'player_ajax',
        post,
        nume,
        type
    });

    try {
        const { data } = await axios.post(PLAYER_AJAX_URL, payload.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': BASE_URL,
                'Origin': BASE_URL
            }
        });
        if (!data) return null;
        const $ = cheerio.load(data);
        const iframeSrc = $('iframe').attr('src');
        return iframeSrc ? iframeSrc.trim() : null;
    } catch (error) {
        console.warn('fetchAjaxPlayerIframe error:', error.message);
        return null;
    }
}

module.exports = {
    BASE_URL,
    PLAYER_AJAX_URL,
    USER_AGENT,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    fetchAjaxPlayerIframe,
    fetchDocument
};
