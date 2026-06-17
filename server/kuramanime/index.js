// Import all modules
const helpers = require('./helpers');
const pages = require('./pages');
const list = require('./list');
const search = require('./search');
const properties = require('./properties');

// Export all functions
module.exports = {
    // Helper functions
    extractStreamingUrls: helpers.extractStreamingUrls,
    extractStreamingUrlsForServer: helpers.extractStreamingUrlsForServer,
    getImageHash: helpers.getImageHash,
    proxyImageUrl: helpers.proxyImageUrl,
    getImageUrlMap: helpers.getImageUrlMap,
    extractSlug: helpers.extractSlug,
    extractAnimeId: helpers.extractAnimeId,

    // Page functions
    scrapeHome: pages.scrapeHome,
    scrapeDetail: pages.scrapeDetail,
    scrapeEpisode: pages.scrapeEpisode,
    scrapeBatch: pages.scrapeBatch,

    // List functions
    scrapeAnimeList: list.scrapeAnimeList,
    scrapeOngoing: list.scrapeOngoing,
    scrapeFinished: list.scrapeFinished,
    scrapeMovie: list.scrapeMovie,
    scrapeSchedule: list.scrapeSchedule,

    // Search functions
    scrapeSearch: search.scrapeSearch,

    // Property functions - Genre
    scrapeGenreList: properties.scrapeGenreList,
    scrapeGenre: properties.scrapeGenre,

    // Property functions - Season
    scrapeSeasonList: properties.scrapeSeasonList,
    scrapeSeason: properties.scrapeSeason,

    // Property functions - Studio
    scrapeStudioList: properties.scrapeStudioList,
    scrapeStudio: properties.scrapeStudio,

    // Property functions - Type
    scrapeTypeList: properties.scrapeTypeList,
    scrapeType: properties.scrapeType,

    // Property functions - Quality
    scrapeQualityList: properties.scrapeQualityList,
    scrapeQuality: properties.scrapeQuality,

    // Property functions - Source
    scrapeSourceList: properties.scrapeSourceList,
    scrapeSource: properties.scrapeSource,

    // Property functions - Country
    scrapeCountryList: properties.scrapeCountryList,
    scrapeCountry: properties.scrapeCountry
};
