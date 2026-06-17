const pages = require('./pages');
const properties = require('./properties');
const helpers = require('./helpers');

module.exports = {
    // Page scraping functions
    scrapeHome: pages.scrapeHome,
    scrapeDetail: pages.scrapeDetail,
    scrapeEpisode: pages.scrapeEpisode,
    scrapeBatch: pages.scrapeBatch,
    
    // Property functions
    scrapeGenreList: properties.scrapeGenreList,
    scrapeGenre: properties.scrapeGenre,
    scrapeTypeList: properties.scrapeTypeList,
    scrapeType: properties.scrapeType,
    scrapeSearch: properties.scrapeSearch,
    scrapeAnimeList: properties.scrapeAnimeList,
    
    // Helper functions
    getImageUrlMap: helpers.getImageUrlMap,
    proxyImageUrl: helpers.proxyImageUrl,
    extractSlug: helpers.extractSlug,
    extractAnimeId: helpers.extractAnimeId,
    BASE_URL: helpers.BASE_URL
};
