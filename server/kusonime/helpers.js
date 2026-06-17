// Kusonime V8 Scraper - Helper Functions

const crypto = require('crypto');

const BASE_URL = 'https://kusonime.com';
const imageUrlMap = new Map();

function toAbsoluteUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;

    try {
        return new URL(url, BASE_URL).toString();
    } catch (error) {
        return url;
    }
}

// Proxy image URL through our server
function proxyImageUrl(imageUrl) {
    if (!imageUrl) return '';

    const absoluteUrl = toAbsoluteUrl(imageUrl);
    if (!absoluteUrl || absoluteUrl.startsWith('data:')) {
        return absoluteUrl;
    }

    const hash = crypto.createHash('md5').update(absoluteUrl).digest('hex');
    imageUrlMap.set(hash, absoluteUrl);
    return `/img/${hash}`;
}

// Get image URL map for proxy
function getImageUrlMap() {
    return imageUrlMap;
}

// Extract slug from URL
function extractSlug(url) {
    if (!url) return '';

    // Remove base URL
    url = url.replace(BASE_URL, '');

    // Extract slug from path
    const match = url.match(/\/([^\/]+)\/?$/);
    return match ? match[1] : url.replace(/\//g, '');
}

// Clean text
function cleanText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
}

module.exports = {
    BASE_URL,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    cleanText
};
