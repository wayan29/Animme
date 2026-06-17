// Otakudesu V1 Scraper - Modularized Index
// Aggregates all modules and exports all functions

// Import helpers
const {
    BASE_URL,
    normalizeImageUrl,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug
} = require('./helpers');

// Import page scraping functions
const {
    scrapeHome,
    scrapeAnimeDetail,
    scrapeEpisode,
    scrapeBatch,
    resolveLatestEpisodeSlugForAnime
} = require('./pages');

// Import list operations
const {
    scrapeOngoingAnime,
    scrapeCompleteAnime,
    scrapeGenreAnime,
    scrapeGenreList,
    scrapeAllAnime,
    scrapeSchedule
} = require('./list');

// Import search
const {
    scrapeSearch
} = require('./search');

// Export all functions organized by category
module.exports = {
    // Helper functions
    BASE_URL,
    normalizeImageUrl,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,

    // Page scraping
    scrapeHome,
    scrapeAnimeDetail,
    scrapeEpisode,
    scrapeBatch,
    resolveLatestEpisodeSlugForAnime,

    // List operations
    scrapeOngoingAnime,
    scrapeCompleteAnime,
    scrapeGenreAnime,
    scrapeGenreList,
    scrapeAllAnime,
    scrapeSchedule,

    // Search
    scrapeSearch
};
