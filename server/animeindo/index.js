// AnimeIndo Scraper - Index
const {
    BASE_URL,
    USER_AGENT,
    imageProxy,
    getImageUrlMap,
    fetchPage,
    extractSlugFromUrl,
    cleanText,
    toAbsoluteUrl
} = require('./helpers');

const {
    scrapeUpdateTerbaru,
    scrapePopular,
    scrapeHomepage
} = require('./home');

const {
    scrapeAnimeList
} = require('./anime-list');

const {
    scrapeAnimeDetail
} = require('./detail');

const {
    scrapeEpisode
} = require('./episode');

const {
    scrapeGenreList
} = require('./genres');

const {
    scrapeMovieList
} = require('./movies');

const {
    scrapeGenreDetail
} = require('./genre-detail');

const {
    scrapeSearch
} = require('./search');

module.exports = {
    BASE_URL,
    USER_AGENT,
    imageProxy,
    getImageUrlMap,
    fetchPage,
    extractSlugFromUrl,
    cleanText,
    toAbsoluteUrl,
    scrapeUpdateTerbaru,
    scrapePopular,
    scrapeHomepage,
    scrapeAnimeList,
    scrapeAnimeDetail,
    scrapeEpisode,
    scrapeGenreList,
    scrapeMovieList,
    scrapeGenreDetail,
    scrapeSearch
};
