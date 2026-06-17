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
const { scrapeHentaiList, scrapeHentaiListByLetter } = require('./list');

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
    scrapeHentaiList,
    scrapeHentaiListByLetter
};
