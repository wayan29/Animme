// Anoboy Scraper - Main Index
// Aggregates all modules and exports all functions

// Import helpers
const {
    BASE_URL,
    USER_AGENT,
    imageProxy,
    getImageUrlMap,
    fetchPage,
    extractSlugFromUrl,
    cleanText
} = require('./helpers');

// Import home scraping functions
const {
    scrapeLatestReleases,
    scrapeRecommendation,
    scrapeOngoing,
    scrapeHomepage
} = require('./home');

// Import detail scraping functions
const {
    scrapeAnimeDetail
} = require('./detail');

// Import episode scraping functions
const {
    scrapeEpisode
} = require('./episode');

// Import search functions
const {
    scrapeSearch
} = require('./search');

// Import A-Z list functions
const {
    scrapeAZList
} = require('./azlist');

// Import latest release functions
const {
    scrapeLatestRelease
} = require('./latest');

// Export all functions organized by category
module.exports = {
    // Helper functions
    BASE_URL,
    USER_AGENT,
    imageProxy,
    getImageUrlMap,
    fetchPage,
    extractSlugFromUrl,
    cleanText,

    // Home scraping
    scrapeLatestReleases,
    scrapeRecommendation,
    scrapeOngoing,
    scrapeHomepage,

    // Detail scraping
    scrapeAnimeDetail,

    // Episode scraping
    scrapeEpisode,

    // Search
    scrapeSearch,

    // A-Z List
    scrapeAZList,

    // Latest Release
    scrapeLatestRelease
};
