// Import helpers
const {
    BASE_URL,
    USER_AGENT,
    normalizeImageUrl,
    getImageHash,
    imageProxy,
    getImageUrlMap,
    fetchPage,
    extractSlugFromUrl,
    cleanText,
    parseEpisodeNumber
} = require('./helpers');

// Import scrapers
const { scrapeHomepage } = require('./home');
const { scrapeAnimeDetail } = require('./detail');
const { scrapeEpisode } = require('./episode');
const { scrapeSearch } = require('./search');
const { CATEGORIES, scrapeCategory } = require('./category');
const { scrapeGenreList, scrapeGenre } = require('./genre');
const { scrapeRandom } = require('./random');
const { scrapeSchedule } = require('./schedule');
const { scrapeHentaiList, scrapeHentaiListByLetter, scrapeJavList, scrapeJavListByLetter } = require('./list');

// Export all modules
module.exports = {
    // Helpers
    BASE_URL,
    USER_AGENT,
    normalizeImageUrl,
    getImageHash,
    imageProxy,
    getImageUrlMap,
    fetchPage,
    extractSlugFromUrl,
    cleanText,
    parseEpisodeNumber,

    // Scrapers
    scrapeHomepage,
    scrapeAnimeDetail,
    scrapeEpisode,
    scrapeSearch,
    CATEGORIES,
    scrapeCategory,
    scrapeGenreList,
    scrapeGenre,
    scrapeRandom,
    scrapeSchedule,
    scrapeHentaiList,
    scrapeHentaiListByLetter,
    scrapeJavList,
    scrapeJavListByLetter
};
