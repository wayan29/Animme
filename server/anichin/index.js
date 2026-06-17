// Anichin Scraper - Modularized Index
// Aggregates all modules and exports all functions

// Import helpers
const {
    BASE_URL,
    USER_AGENT,
    imageProxy,
    fetchPage,
    extractSlugFromUrl
} = require('./helpers');

// Import home scraping functions
const {
    scrapeBannerRecommendations,
    scrapePopularToday,
    scrapeLatestReleases,
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

const {
    scrapeCompleted
} = require('./completed');

// Export all functions organized by category
module.exports = {
    // Helper functions
    BASE_URL,
    USER_AGENT,
    imageProxy,
    fetchPage,
    extractSlugFromUrl,

    // Home scraping
    scrapeBannerRecommendations,
    scrapePopularToday,
    scrapeLatestReleases,
    scrapeHomepage,

    // Detail scraping
    scrapeAnimeDetail,

    // Episode scraping
    scrapeEpisode,

    // Completed list
    scrapeCompleted
};
