// AnimeIndo Helper Functions
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const BASE_URL = 'https://anime-indo.lol';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Store mapping between hashed image path and original URL
const imageUrlMap = new Map();

/**
 * Generate deterministic hash for a URL
 * @param {string} url
 * @returns {string}
 */
function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * Convert relative URL to absolute using BASE_URL
 * @param {string} value
 * @returns {string|null}
 */
function toAbsoluteUrl(value) {
    if (!value) return null;
    try {
        const absoluteUrl = new URL(value, BASE_URL);
        return absoluteUrl.toString();
    } catch (error) {
        return null;
    }
}

/**
 * Register image URL for proxy usage
 * @param {string} imageUrl
 * @returns {string|null}
 */
function imageProxy(imageUrl) {
    const absoluteUrl = toAbsoluteUrl(imageUrl);
    if (!absoluteUrl) return null;

    const hash = getImageHash(absoluteUrl);
    imageUrlMap.set(hash, absoluteUrl);
    return `/img/${hash}`;
}

/**
 * Expose stored image URL map
 * @returns {Map<string, string>}
 */
function getImageUrlMap() {
    return imageUrlMap;
}

/**
 * Fetch HTML page and return Cheerio instance
 * @param {string} url
 * @param {number} retries
 * @returns {Promise<CheerioStatic>}
 */
async function fetchPage(url, retries = 3) {
    const targetUrl = toAbsoluteUrl(url) || BASE_URL;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axios.get(targetUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': BASE_URL
                },
                timeout: 15000
            });

            return cheerio.load(response.data);
        } catch (error) {
            if (attempt === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
}

/**
 * Extract slug from URL path
 * @param {string} url
 * @returns {string}
 */
function extractSlugFromUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url, BASE_URL);
        return parsed.pathname.replace(/^\/|\/$/g, '');
    } catch (error) {
        return '';
    }
}

/**
 * Normalize text by trimming and collapsing whitespace
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

module.exports = {
    BASE_URL,
    USER_AGENT,
    imageProxy,
    getImageUrlMap,
    fetchPage,
    extractSlugFromUrl,
    cleanText,
    toAbsoluteUrl
};
