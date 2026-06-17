const crypto = require('crypto');

const BASE_URL = 'https://otakudesu.blog';

function normalizeImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('//')) {
        return `https:${url}`;
    }
    if (url.startsWith('/')) {
        return `${BASE_URL}${url}`;
    }
    return url;
}

// Helper untuk generate hash dari URL gambar
function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

// Helper untuk store image URL mapping
const imageUrlMap = new Map();

function proxyImageUrl(url) {
    const normalizedUrl = normalizeImageUrl(url);
    if (!normalizedUrl || !normalizedUrl.startsWith('http')) return normalizedUrl;
    const hash = getImageHash(normalizedUrl);
    imageUrlMap.set(hash, normalizedUrl);
    return `/img/${hash}`;
}

// Get Image URL Map (untuk server.js akses)
function getImageUrlMap() {
    return imageUrlMap;
}

// Extract slug from URL
function extractSlug(url) {
    if (!url) return '';
    
    // Try anime URL pattern first
    let match = url.match(/\/anime\/([^\/]+)/);
    if (match) return match[1];
    
    // Try episode URL pattern
    match = url.match(/\/episode\/([^\/]+)/);
    if (match) return match[1];
    
    // Try batch URL pattern
    match = url.match(/\/batch\/([^\/]+)/);
    if (match) return match[1];
    
    return '';
}

module.exports = {
    BASE_URL,
    normalizeImageUrl,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug
};
