 const {
     BASE_URL,
     getImageHash,
     proxyImageUrl,
     getImageUrlMap,
     extractSlug,
     fetchDocument
 } = require('./helpers');
 
 const {
     scrapeHome,
     scrapeAnimeDetail,
     scrapeEpisode
 } = require('./pages');
 
 const {
     scrapeAnimeList,
     scrapeSchedule,
     scrapeAllAnime
 } = require('./list');
 
 const {
     scrapeSearch,
     scrapeAdvancedSearchConfig,
     scrapeAdvancedSearch
 } = require('./search');
 
 module.exports = {
     BASE_URL,
     getImageHash,
     proxyImageUrl,
     getImageUrlMap,
     extractSlug,
     fetchDocument,
     scrapeHome,
     scrapeAnimeDetail,
     scrapeEpisode,
     scrapeAnimeList,
     scrapeSchedule,
     scrapeAllAnime,
     scrapeSearch,
     scrapeAdvancedSearchConfig,
     scrapeAdvancedSearch
 };
