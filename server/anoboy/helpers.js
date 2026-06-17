// Anoboy Helper Functions
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const BASE_URL = 'https://anoboy.be';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Image hash storage
const imageUrlMap = new Map();

/**
 * Generate hash from URL for image caching
 */
function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * Process image URL and return cached path
 */
function imageProxy(imageUrl) {
    if (!imageUrl || imageUrl === '') return null;

    const hash = getImageHash(imageUrl);
    imageUrlMap.set(hash, imageUrl);

    return `/img/${hash}`;
}

/**
 * Get image URL map for server use
 */
function getImageUrlMap() {
    return imageUrlMap;
}

/**
 * Fetch page with retry logic
 */
async function fetchPage(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
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
            if (i === retries - 1) throw error;
            console.warn(`[Anoboy] Retry ${i + 1}/${retries} for ${url}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

/**
 * Extract slug from URL
 */
function extractSlugFromUrl(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        // Remove leading/trailing slashes and return
        return pathname.replace(/^\/|\/$/g, '');
    } catch (error) {
        return '';
    }
}

/**
 * Clean text by removing extra whitespace
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
    cleanText
};
