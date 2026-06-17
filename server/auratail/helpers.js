const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const puppeteer = require('puppeteer');

const BASE_URL = 'https://auratail.vip';

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

        // Sort sources by quality (lowest to highest) for optimal loading
        sources.sort((a, b) => {
            const qualityA = parseInt(a.quality) || 999;
            const qualityB = parseInt(b.quality) || 999;
            return qualityA - qualityB;
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

        return sources;
    } catch (error) {
        console.warn(`Failed to extract from ${serverName}:`, error.message);
        return [];
    }
}

// Helper function to extract streaming URLs from all servers
async function extractStreamingUrls(page, url, animeId, slug, episodeNum) {
    try {
        const html = await page.content();
        const $ = cheerio.load(html);

        // For WordPress anime sites, extract from multiple possible sources
        const sources = [];

        // Check for multiple video sources in the page
        $('video source').each((i, el) => {
            const src = $(el).attr('src');
            const quality = $(el).attr('size') || $(el).attr('data-quality');
            const type = $(el).attr('type') || 'video/mp4';

            if (src) {
                sources.push({
                    quality: quality ? `${quality}p` : 'unknown',
                    type: type,
                    url: src
                });
            }
        });

        // Also check for iframe sources
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && (src.includes('player') || src.includes('embed'))) {
                sources.push({
                    quality: 'iframe',
                    type: 'text/html',
                    url: src
                });
            }
        });

        // Check for data attributes that might contain video URLs
        $('[data-src], [data-video], [data-url]').each((i, el) => {
            const src = $(el).attr('data-src') || $(el).attr('data-video') || $(el).attr('data-url');
            if (src && src.includes('mp4') || src.includes('m3u8')) {
                sources.push({
                    quality: 'auto',
                    type: src.includes('m3u8') ? 'application/x-mpegURL' : 'video/mp4',
                    url: src
                });
            }
        });

        // Sort sources by quality
        sources.sort((a, b) => {
            const qualityOrder = ['iframe', 'auto', 'unknown'];
            const aIndex = qualityOrder.indexOf(a.quality);
            const bIndex = qualityOrder.indexOf(b.quality);
            if (aIndex !== bIndex) {
                return aIndex - bIndex;
            }
            return 0;
        });

        return {
            servers: {
                'default': sources
            },
            default_server: 'default',
            sources: sources
        };

    } catch (error) {
        console.error('Error extracting streaming URLs:', error.message);
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
    // For auratail.vip: extract from /anime-name/ or /anime-name
    const match = url.match(/\/([^\/\?]+)\/*(?:\?|$)/);
    return match ? match[1] : '';
}

function extractAnimeSlug(url) {
    if (!url) return '';
    // Extract anime slug from episode URL
    // For URLs like: /divine-manifestation-episode-9/ -> divine-manifestation
    // Or: /anime-name/ -> anime-name
    
    // First extract the path part from URL
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Try to extract anime slug before "-episode-"
    const episodeMatch = path.match(/\/([^\/-]+)-episode-/);
    if (episodeMatch) {
        return episodeMatch[1];
    }
    
    // Fallback: extract from path before first "/" or "-"
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    if (cleanPath.includes('-episode-')) {
        return cleanPath.split('-episode-')[0];
    }
    
    // Fallback to regular slug extraction
    const match = path.match(/\/([^\/\?]+)\/*(?:\?|$)/);
    return match ? match[1] : '';
}

function extractAnimeIdFromSlug(slug) {
    if (!slug) return '';
    // Create a consistent hash-like ID from anime slug
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
        const char = slug.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
}

function extractAnimeId(url) {
    if (!url) return '';
    // For auratail.vip, we'll generate a simple ID based on the slug
    const slug = extractSlug(url);
    if (slug) {
        // Create a simple hash-like ID from slug for auratail
        let hash = 0;
        for (let i = 0; i < slug.length; i++) {
            const char = slug.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString();
    }
    return '';
}

module.exports = {
    extractStreamingUrls,
    extractStreamingUrlsForServer,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    extractAnimeSlug,
    extractAnimeId,
    extractAnimeIdFromSlug,
    BASE_URL
};
