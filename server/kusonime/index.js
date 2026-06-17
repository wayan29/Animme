// Kusonime V8 Scraper - Main Index

const { BASE_URL, proxyImageUrl, getImageUrlMap, extractSlug, cleanText } = require('./helpers');
const { scrapeHome } = require('./home');
const { scrapeAnimeList, scrapeGenres, scrapeSeasons, scrapeGenre, scrapeSeason } = require('./catalog');
const { scrapeDetail } = require('./detail');
const { scrapeSearch } = require('./search');

module.exports = {
    // Helpers
    BASE_URL,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    cleanText,

    // Scraping functions
    scrapeHome,
    scrapeAnimeList,
    scrapeGenres,
    scrapeSeasons,
    scrapeGenre,
    scrapeSeason,
    scrapeDetail,
    scrapeSearch
};
