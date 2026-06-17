// Samehadaku V2 Scraper - Modularized Index
// Aggregates all modules and exports all functions

// Import helpers
const {
    BASE_URL,
    PLAYER_AJAX_URL,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    fetchAjaxPlayerIframe
} = require('./helpers');

// Import page scraping functions
const {
    scrapeHome,
    scrapeAnimeDetail,
    scrapeEpisode
} = require('./pages');

// Import list operations
const {
    scrapeAnimeList,
    scrapeSchedule,
    scrapeAllAnime
} = require('./list');

// Import search
const {
    scrapeSearch
} = require('./search');

// Export all functions organized by category
module.exports = {
    // Helper functions
    BASE_URL,
    PLAYER_AJAX_URL,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    fetchAjaxPlayerIframe,

    // Page scraping
    scrapeHome,
    scrapeAnimeDetail,
    scrapeEpisode,

    // List operations
    scrapeAnimeList,
    scrapeSchedule,
    scrapeAllAnime,

    // Search
    scrapeSearch
};
