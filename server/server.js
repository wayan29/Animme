require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const scraper = require('./otakudesu');
const samehadakuScraper = require('./samehadaku');
const kuramanimeScraper = require('./kuramanime');
const anichinScraper = require('./anichin');
const anoboyScraper = require('./anoboy');
const animeIndoScraper = require('./animeindo');
const nekopoiScraper = require('./nekopoi');
const kusonimeScraper = require('./kusonime');
const auratailScraper = require('./auratail');
const hlsService = require('./hls-service');
const vidkuScraper = require('./vidku');
const { registerPages } = require('./routes/pages');
const { createSharedRoutes } = require('./routes/shared');
const { registerHlsRoutes } = require('./routes/hls');
const { registerOtakudesuRoutes } = require('./routes/otakudesu');
const { registerSamehadakuRoutes } = require('./routes/samehadaku');
const { createStaleCache, createResponseCache, createKeyedStaleCache } = require('./utils/response-cache');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize HLS service
hlsService.initialize();

// Enable CORS for public API access
app.use(cors({
    origin: '*', // Allow all origins (can be restricted to specific domains)
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Enable JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CACHE_DIR = path.join(__dirname, '../cache/images');
const SERVER_STARTED_AT = Date.now();
const homeCache = createStaleCache({
    freshMs: 3 * 60 * 1000,
    staleMs: 10 * 60 * 1000
});
const latestEpisodeCache = createResponseCache();
const apiResponseCache = createResponseCache();
const scheduleCache = createStaleCache({
    freshMs: 10 * 60 * 1000,
    staleMs: 30 * 60 * 1000
});
const v2HomeCache = createStaleCache({
    freshMs: 3 * 60 * 1000,
    staleMs: 10 * 60 * 1000
});
const v3KuramanimeCache = createKeyedStaleCache({
    freshMs: 5 * 60 * 1000,
    staleMs: 30 * 60 * 1000,
    maxEntries: 300
});
const v3KuramanimeDetailCache = createKeyedStaleCache({
    freshMs: Number(process.env.KURAMANIME_DETAIL_CACHE_FRESH_MS) || 30 * 60 * 1000,
    staleMs: Number(process.env.KURAMANIME_DETAIL_CACHE_STALE_MS) || 2 * 60 * 60 * 1000,
    maxEntries: Number(process.env.KURAMANIME_DETAIL_CACHE_MAX_ENTRIES) || 300
});
const v3KuramanimeStaticCache = createKeyedStaleCache({
    freshMs: 60 * 60 * 1000,
    staleMs: 6 * 60 * 60 * 1000,
    maxEntries: 100
});
const v8KusonimeHomeCache = createKeyedStaleCache({
    freshMs: Number(process.env.KUSONIME_HOME_CACHE_FRESH_MS) || 5 * 60 * 1000,
    staleMs: Number(process.env.KUSONIME_HOME_CACHE_STALE_MS) || 30 * 60 * 1000,
    maxEntries: Number(process.env.KUSONIME_HOME_CACHE_MAX_ENTRIES) || 200
});
const v8KusonimeAnimeListCache = createKeyedStaleCache({
    freshMs: Number(process.env.KUSONIME_ANIME_LIST_CACHE_FRESH_MS) || 10 * 60 * 1000,
    staleMs: Number(process.env.KUSONIME_ANIME_LIST_CACHE_STALE_MS) || 60 * 60 * 1000,
    maxEntries: Number(process.env.KUSONIME_ANIME_LIST_CACHE_MAX_ENTRIES) || 300
});

const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    message: {
        status: 'error',
        message: 'Terlalu banyak request. Coba lagi dalam 1 menit.'
    }
});

const DEFAULT_REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

const ITAG_QUALITY_MAP = {
    '18': '360p',
    '22': '720p',
    '37': '1080p',
    '59': '480p',
    '78': '480p',
    '82': '360p',
    '83': '480p',
    '84': '720p',
    '85': '1080p'
};

const sharedRoutes = createSharedRoutes({
    cacheDir: CACHE_DIR,
    defaultRequestHeaders: DEFAULT_REQUEST_HEADERS,
    itagQualityMap: ITAG_QUALITY_MAP,
    scrapers: [
        scraper,
        samehadakuScraper,
        kuramanimeScraper,
        anoboyScraper,
        animeIndoScraper,
        nekopoiScraper,
        kusonimeScraper,
        auratailScraper,
        vidkuScraper
    ]
});
const { buildRequestHeaders, rewriteDashManifest, resolveStreamUrl } = sharedRoutes.helpers;

// Ensure cache directory exists
fs.mkdir(CACHE_DIR, { recursive: true }).catch(console.error);

// Serve static files FIRST (important for .js, .css, etc)
// Serve version-specific files with path prefix (important for version-specific app.js)
app.use('/v1', express.static(path.join(__dirname, '../public/v1')));
app.use('/v2', express.static(path.join(__dirname, '../public/v2')));
app.use('/v3', express.static(path.join(__dirname, '../public/v3')));
app.use('/v4', express.static(path.join(__dirname, '../public/v4')));
app.use('/v5', express.static(path.join(__dirname, '../public/v5')));
app.use('/v6', express.static(path.join(__dirname, '../public/v6')));
app.use('/v7', express.static(path.join(__dirname, '../public/v7')));
app.use('/v8', express.static(path.join(__dirname, '../public/v8')));
app.use('/v9', express.static(path.join(__dirname, '../public/v9')));
app.use('/v10', express.static(path.join(__dirname, '../public/v10')));

// Serve shared assets globally (CSS, docs)
app.use(express.static(path.join(__dirname, '../public/shared')));

// Serve main public directory (for index.html)
app.use(express.static(path.join(__dirname, '../public')));

// Admin Routes
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
sharedRoutes.register(app);

app.use('/api', apiRateLimiter);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime_seconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
        cache: {
            home: homeCache.getStats(),
            schedule: scheduleCache.getStats(),
            v2_home: v2HomeCache.getStats(),
            v3_kuramanime: v3KuramanimeCache.getStats(),
            v3_kuramanime_detail: v3KuramanimeDetailCache.getStats(),
            v3_kuramanime_static: v3KuramanimeStaticCache.getStats(),
            v8_kusonime_home: v8KusonimeHomeCache.getStats(),
            v8_kusonime_anime_list: v8KusonimeAnimeListCache.getStats()
        }
    });
});

registerOtakudesuRoutes(app, {
    scraper,
    homeCache,
    latestEpisodeCache,
    apiResponseCache,
    scheduleCache,
    resolveStreamUrl
});

registerSamehadakuRoutes(app, {
    samehadakuScraper,
    v2HomeCache
});

// ==================== API V3 - KURAMANIME ====================

async function sendCachedKuramanime(res, cache, key, loader) {
    const { value, cache: cacheStatus } = await cache.get(key, loader);
    res.set('X-Cache', cacheStatus);
    res.json({ status: 'success', data: value });
}

async function sendCachedJson(res, cache, key, loader) {
    const { value, cache: cacheStatus } = await cache.get(key, loader);
    res.set('X-Cache', cacheStatus);
    res.json(value);
}

app.get('/api/v3/kuramanime/home', async (req, res) => {
    try {
        await sendCachedKuramanime(res, v3KuramanimeCache, 'home', async () => {
            console.log('[V3] Scraping kuramanime homepage...');
            return kuramanimeScraper.scrapeHome();
        });
    } catch (error) {
        console.error('[V3] API Error /home:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/anime/:animeId/:slug', async (req, res) => {
    try {
        const { animeId, slug } = req.params;

        if (!/^\d{1,20}$/.test(animeId)) {
            return res.status(400).json({ status: 'error', message: 'Invalid animeId' });
        }

        const isValidSlug = typeof slug === 'string' &&
            slug.length >= 1 &&
            slug.length <= 200 &&
            !slug.includes('/') &&
            !slug.includes('\\') &&
            !/[\x00-\x1F\x7F]/.test(slug);

        if (!isValidSlug) {
            return res.status(400).json({ status: 'error', message: 'Invalid slug' });
        }

        const cacheKey = `detail:${animeId}:${slug}`;
        await sendCachedKuramanime(res, v3KuramanimeDetailCache, cacheKey, async () => {
            console.log(`[V3] Scraping kuramanime anime detail: ${animeId}/${slug}`);
            return kuramanimeScraper.scrapeDetail(animeId, slug);
        });
    } catch (error) {
        console.error('[V3] API Error /anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/episode/:animeId/:slug/:episodeNum', async (req, res) => {
    try {
        const { animeId, slug, episodeNum } = req.params;

        if (!/^\d{1,20}$/.test(animeId)) {
            return res.status(400).json({ status: 'error', message: 'Invalid animeId' });
        }

        if (!/^\d{1,6}$/.test(episodeNum)) {
            return res.status(400).json({ status: 'error', message: 'Invalid episodeNum' });
        }

        const isValidSlug = typeof slug === 'string' &&
            slug.length >= 1 &&
            slug.length <= 200 &&
            !slug.includes('/') &&
            !slug.includes('\\') &&
            !/[\x00-\x1F\x7F]/.test(slug);

        if (!isValidSlug) {
            return res.status(400).json({ status: 'error', message: 'Invalid slug' });
        }

        console.log(`[V3] Scraping kuramanime episode: ${animeId}/${slug}/${episodeNum}`);
        const data = await kuramanimeScraper.scrapeEpisode(animeId, slug, episodeNum);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /episode:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/search', async (req, res) => {
    try {
        const query = req.query.q || req.query.query || req.query.search;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'ascending';

        if (!query) {
            return res.status(400).json({ status: 'error', message: 'Query parameter is required' });
        }

        console.log(`[V3] Searching kuramanime for: "${query}" (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeSearch(query, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /search:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/anime-list', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || null;
        console.log(`[V3] Scraping kuramanime anime list (page ${page}, order: ${orderBy || 'default'})`);
        const data = await kuramanimeScraper.scrapeAnimeList(page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /anime-list:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/ongoing', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Scraping kuramanime ongoing anime (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeOngoing(page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /ongoing:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/finished', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Scraping kuramanime finished anime (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeFinished(page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /finished:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/movie', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Scraping kuramanime movie anime (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeMovie(page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /movie:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/schedule', async (req, res) => {
    try {
        const day = req.query.day || req.query.scheduled_day || 'all';
        console.log(`[V3] Scraping kuramanime schedule (day: ${day})`);
        const data = await kuramanimeScraper.scrapeSchedule(day);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /schedule:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/genres', async (req, res) => {
    try {
        await sendCachedKuramanime(res, v3KuramanimeStaticCache, 'genres', async () => {
            console.log('[V3] Fetching kuramanime genre list');
            return kuramanimeScraper.scrapeGenreList();
        });
    } catch (error) {
        console.error('[V3] API Error /genres:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Genre with query parameter (e.g. ?genre=comedy)
app.get('/api/v3/kuramanime/genre', async (req, res) => {
    try {
        const genreSlug = req.query.genre;
        if (!genreSlug) {
            return res.status(400).json({ status: 'error', message: 'Genre parameter is required' });
        }
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Scraping kuramanime genre: ${genreSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeGenre(genreSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /genre:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Genre with route parameter (e.g. /genre/comedy)
app.get('/api/v3/kuramanime/genre/:slug', async (req, res) => {
    try {
        const genreSlug = req.params.slug;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'ascending';
        console.log(`[V3] Scraping kuramanime genre: ${genreSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeGenre(genreSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /genre:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/seasons', async (req, res) => {
    try {
        await sendCachedKuramanime(res, v3KuramanimeStaticCache, 'seasons', async () => {
            console.log('[V3] Fetching kuramanime season list');
            return kuramanimeScraper.scrapeSeasonList();
        });
    } catch (error) {
        console.error('[V3] API Error /seasons:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/v3/kuramanime/season/:slug', async (req, res) => {
    try {
        const seasonSlug = req.params.slug;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'ascending';
        console.log(`[V3] Scraping kuramanime season: ${seasonSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeSeason(seasonSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /season:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Studio List
app.get('/api/v3/kuramanime/studios', async (req, res) => {
    try {
        await sendCachedKuramanime(res, v3KuramanimeStaticCache, 'studios', async () => {
            console.log('[V3] Fetching kuramanime studio list');
            return kuramanimeScraper.scrapeStudioList();
        });
    } catch (error) {
        console.error('[V3] API Error /studios:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Studio Detail (Anime by Studio)
app.get('/api/v3/kuramanime/studio/:studioSlug', async (req, res) => {
    try {
        const { studioSlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'ascending';
        console.log(`[V3] Fetching anime for studio: ${studioSlug} (page ${page})`);
        const data = await kuramanimeScraper.scrapeStudio(studioSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /studio/${req.params.studioSlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Type List
app.get('/api/v3/kuramanime/types', async (req, res) => {
    try {
        await sendCachedKuramanime(res, v3KuramanimeStaticCache, 'types', async () => {
            console.log('[V3] Fetching kuramanime type list');
            return kuramanimeScraper.scrapeTypeList();
        });
    } catch (error) {
        console.error('[V3] API Error /types:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Type with query parameter (e.g. /type?type=tv)
app.get('/api/v3/kuramanime/type', async (req, res) => {
    try {
        const typeSlug = req.query.type;
        if (!typeSlug) {
            return res.status(400).json({ status: 'error', message: 'Type parameter is required' });
        }
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || req.query.orderBy || 'updated';
        console.log(`[V3] Fetching anime for type: ${typeSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeType(typeSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /type:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Type Detail with route parameter (e.g. /type/tv)
app.get('/api/v3/kuramanime/type/:typeSlug', async (req, res) => {
    try {
        const { typeSlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'updated';
        console.log(`[V3] Fetching anime for type: ${typeSlug} (page ${page}, order: ${orderBy})`);
        const data = await kuramanimeScraper.scrapeType(typeSlug, page, orderBy);
        console.log(`[V3] scrapeType returned ${data.anime_list?.length || 0} anime`);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /type/${req.params.typeSlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Quality List
app.get('/api/v3/kuramanime/qualities', async (req, res) => {
    try {
        await sendCachedKuramanime(res, v3KuramanimeStaticCache, 'qualities', async () => {
            console.log('[V3] Fetching kuramanime quality list');
            return kuramanimeScraper.scrapeQualityList();
        });
    } catch (error) {
        console.error('[V3] API Error /qualities:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Quality Detail (Anime by Quality)
app.get('/api/v3/kuramanime/quality/:qualitySlug', async (req, res) => {
    try {
        const { qualitySlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'ascending';
        console.log(`[V3] Fetching anime for quality: ${qualitySlug} (page ${page})`);
        const data = await kuramanimeScraper.scrapeQuality(qualitySlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /quality/${req.params.qualitySlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Source List (Adaptasi)
app.get('/api/v3/kuramanime/sources', async (req, res) => {
    try {
        await sendCachedKuramanime(res, v3KuramanimeStaticCache, 'sources', async () => {
            console.log('[V3] Fetching kuramanime source list');
            return kuramanimeScraper.scrapeSourceList();
        });
    } catch (error) {
        console.error('[V3] API Error /sources:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Source Detail (Anime by Source/Adaptasi)
app.get('/api/v3/kuramanime/source/:sourceSlug', async (req, res) => {
    try {
        const { sourceSlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'ascending';
        console.log(`[V3] Fetching anime for source: ${sourceSlug} (page ${page})`);
        const data = await kuramanimeScraper.scrapeSource(sourceSlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /source/${req.params.sourceSlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Country List
app.get('/api/v3/kuramanime/countries', async (req, res) => {
    try {
        await sendCachedKuramanime(res, v3KuramanimeStaticCache, 'countries', async () => {
            console.log('[V3] Fetching kuramanime country list');
            return kuramanimeScraper.scrapeCountryList();
        });
    } catch (error) {
        console.error('[V3] API Error /countries:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Country Detail (Anime by Country)
app.get('/api/v3/kuramanime/country/:countrySlug', async (req, res) => {
    try {
        const { countrySlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const orderBy = req.query.order_by || 'ascending';
        console.log(`[V3] Fetching anime for country: ${countrySlug} (page ${page})`);
        const data = await kuramanimeScraper.scrapeCountry(countrySlug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error(`[V3] API Error /country/${req.params.countrySlug}:`, error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Properties Overview (All)
app.get('/api/v3/kuramanime/properties', async (req, res) => {
    try {
        await sendCachedKuramanime(res, v3KuramanimeStaticCache, 'properties', async () => {
            console.log('[V3] Fetching all kuramanime properties');
            const [genres, seasons, studios, types, qualities, sources, countries] = await Promise.all([
                kuramanimeScraper.scrapeGenreList(),
                kuramanimeScraper.scrapeSeasonList(),
                kuramanimeScraper.scrapeStudioList(),
                kuramanimeScraper.scrapeTypeList(),
                kuramanimeScraper.scrapeQualityList(),
                kuramanimeScraper.scrapeSourceList(),
                kuramanimeScraper.scrapeCountryList()
            ]);
            return {
                genres,
                seasons,
                studios,
                types,
                qualities,
                sources,
                countries
            };
        });
    } catch (error) {
        console.error('[V3] API Error /properties:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// V3 Kuramanime Batch Download
app.get('/api/v3/kuramanime/batch/:animeId/:slug/:range', async (req, res) => {
    try {
        const { animeId, slug, range } = req.params;
        console.log(`[V3] Scraping kuramanime batch: ${animeId}/${slug}/${range}`);
        const data = await kuramanimeScraper.scrapeBatch(animeId, slug, range);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V3] API Error /batch:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

registerPages(app);

// V4 API Routes - Anichin.cafe
app.get('/api/v4/anichin/home', async (req, res) => {
    try {
        console.log('[V4] Anichin API - Homepage request');
        const data = await anichinScraper.scrapeHomepage();
        res.json(data);
    } catch (error) {
        console.error('[V4] Anichin API - Homepage error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch homepage data',
            data: {
                banner_recommendations: [],
                popular_today: [],
                latest_releases: []
            }
        });
    }
});

app.get('/api/v4/anichin/banner-recommendations', async (req, res) => {
    try {
        console.log('[V4] Anichin API - Banner recommendations request');
        console.log('[V4] Anichin scraper type:', typeof anichinScraper);
        console.log('[V4] Anichin scraper is function:', typeof anichinScraper.scrapeBannerRecommendations);
        const data = await anichinScraper.scrapeBannerRecommendations();
        res.json({
            status: 'success',
            data: data,
            total: data.length
        });
    } catch (error) {
        console.error('[V4] Anichin API - Banner recommendations error:', error.message);
        console.error('[V4] Full error stack:', error.stack);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch banner recommendations',
            data: []
        });
    }
});

app.get('/api/v4/anichin/popular-today', async (req, res) => {
    try {
        console.log('[V4] Anichin API - Popular today request');
        const data = await anichinScraper.scrapePopularToday();
        res.json({
            status: 'success',
            data: data,
            total: data.length
        });
    } catch (error) {
        console.error('[V4] Anichin API - Popular today error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch popular today data',
            data: []
        });
    }
});

app.get('/api/v4/anichin/latest-releases', async (req, res) => {
    try {
        console.log('[V4] Anichin API - Latest releases request');
        const data = await anichinScraper.scrapeLatestReleases();
        res.json({
            status: 'success',
            data: data,
            total: data.length
        });
    } catch (error) {
        console.error('[V4] Anichin API - Latest releases error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch latest releases',
            data: []
        });
    }
});

app.get('/api/v4/anichin/completed', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V4] Anichin API - Completed request (page ${page})`);
        const data = await anichinScraper.scrapeCompleted(page);
        res.json({
            status: 'success',
            data: data,
            total: Array.isArray(data?.list) ? data.list.length : 0
        });
    } catch (error) {
        console.error('[V4] Anichin API - Completed error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch completed list',
            data: []
        });
    }
});

app.get('/api/v4/anichin/detail/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        console.log(`[V4] Anichin API - Detail request for: ${slug}`);
        const data = await anichinScraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error(`[V4] Anichin API - Detail error for ${req.params.slug}:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime detail',
            data: null
        });
    }
});

app.get('/api/v4/anichin/episode', async (req, res) => {
    try {
        const slug = req.query.slug;
        if (!slug) {
            return res.status(400).json({
                status: 'error',
                message: 'Parameter slug wajib diisi',
                data: null
            });
        }
        console.log(`[V4] Anichin API - Episode request for: ${slug}`);
        const data = await anichinScraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error(`[V4] Anichin API - Episode error for ${req.query.slug}:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch episode data',
            data: null
        });
    }
});

// ==================== API V5 - ANOBOY ====================

app.get('/api/v5/anoboy/home', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        console.log(`[V5] Anoboy API - Homepage request (page ${page})`);
        const data = await anoboyScraper.scrapeHomepage(page);
        res.json(data);
    } catch (error) {
        console.error('[V5] Anoboy API - Homepage error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch homepage data',
            data: {
                latest_releases: [],
                recommendations: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v5/anoboy/latest', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        console.log(`[V5] Anoboy API - Latest Release request for page: ${page}`);
        const data = await anoboyScraper.scrapeLatestRelease(page);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - Latest Release error:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch latest release',
            data: { current_page: 1, anime_list: [], total: 0, has_next_page: false, next_page: null }
        });
    }
});

app.get('/api/v5/anoboy/ongoing', async (req, res) => {
    try {
        console.log('[V5] Anoboy API - Ongoing anime request');
        const data = await anoboyScraper.scrapeOngoing();
        res.json({
            status: 'success',
            data: data,
            total: data.length
        });
    } catch (error) {
        console.error('[V5] Anoboy API - Ongoing error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch ongoing anime',
            data: []
        });
    }
});

app.get('/api/v5/anoboy/detail/:slug(*)', async (req, res) => {
    try {
        const { slug } = req.params;
        console.log(`[V5] Anoboy API - Detail request for: ${slug}`);
        const data = await anoboyScraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - Detail error for ${req.params.slug}:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime detail',
            data: null
        });
    }
});

app.get('/api/v5/anoboy/episode/:slug(*)', async (req, res) => {
    try {
        const { slug } = req.params;
        console.log(`[V5] Anoboy API - Episode request for: ${slug}`);
        const data = await anoboyScraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - Episode error for ${req.params.slug}:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch episode data',
            data: null
        });
    }
});

app.get('/api/v5/anoboy/search', async (req, res) => {
    try {
        const keyword = req.query.q || req.query.keyword || req.query.search;
        if (!keyword) {
            return res.status(400).json({
                status: 'error',
                message: 'Parameter q/keyword wajib diisi',
                data: null
            });
        }
        console.log(`[V5] Anoboy API - Search request for: ${keyword}`);
        const data = await anoboyScraper.scrapeSearch(keyword);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - Search error:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to search anime',
            data: { keyword: '', results: [], total: 0 }
        });
    }
});

app.get('/api/v5/anoboy/azlist', async (req, res) => {
    try {
        const letter = (req.query.letter || req.query.show || 'A').toUpperCase();
        console.log(`[V5] Anoboy API - A-Z List request for letter: ${letter}`);
        const data = await anoboyScraper.scrapeAZList(letter);
        res.json(data);
    } catch (error) {
        console.error(`[V5] Anoboy API - A-Z List error:`, error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch A-Z list',
            data: { current_letter: 'A', anime_list: [], alphabet_nav: [], total: 0 }
        });
    }
});

// ==================== API V6 - ANIMEINDO ====================

app.get('/api/v6/animeindo/home', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V6] AnimeIndo API - Home request (page ${page})`);
        const data = await animeIndoScraper.scrapeHomepage(page);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Home error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch homepage data',
            data: {
                update_terbaru: [],
                popular: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v6/animeindo/update-terbaru', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V6] AnimeIndo API - Update Terbaru request (page ${page})`);
        const data = await animeIndoScraper.scrapeUpdateTerbaru(page);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Update Terbaru error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch latest updates',
            data: {
                current_page: 1,
                updates: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v6/animeindo/popular', async (req, res) => {
    try {
        console.log('[V6] AnimeIndo API - Popular request');
        const data = await animeIndoScraper.scrapePopular();
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Popular error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch popular anime',
            data: {
                popular: [],
                total: 0
            }
        });
    }
});

app.get('/api/v6/animeindo/anime-list', async (req, res) => {
    try {
        const letter = (req.query.letter || req.query.l || 'ALL').toString();
        console.log(`[V6] AnimeIndo API - Anime List request (letter: ${letter})`);
        const data = await animeIndoScraper.scrapeAnimeList(letter);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Anime List error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime list',
            data: {
                letter: 'ALL',
                total: 0,
                sections: [],
                anime_list: [],
                available_letters: []
            }
        });
    }
});

app.get('/api/v6/animeindo/detail/:slug(*)', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V6] AnimeIndo API - Detail request for: ${slug}`);
        const data = await animeIndoScraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Detail error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime detail',
            data: null
        });
    }
});

app.get('/api/v6/animeindo/episode/:slug(*)', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V6] AnimeIndo API - Episode request for: ${slug}`);
        const data = await animeIndoScraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Episode error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch episode data',
            data: null
        });
    }
});

app.get('/api/v6/animeindo/genres', async (req, res) => {
    try {
        console.log('[V6] AnimeIndo API - Genres request');
        const data = await animeIndoScraper.scrapeGenreList();
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Genres error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch genre list',
            data: {
                total: 0,
                genres: []
            }
        });
    }
});

app.get('/api/v6/animeindo/genres/:slug(*)', async (req, res) => {
    try {
        const slug = req.params.slug;
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V6] AnimeIndo API - Genre detail request (${slug}, page ${page})`);
        const data = await animeIndoScraper.scrapeGenreDetail(slug, page);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Genre detail error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch genre detail',
            data: {
                genre: '',
                slug: '',
                current_page: 1,
                anime_list: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v6/animeindo/movies', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V6] AnimeIndo API - Movie list request (page ${page})`);
        const data = await animeIndoScraper.scrapeMovieList(page);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Movie list error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch movie list',
            data: {
                current_page: 1,
                movies: [],
                pagination: {}
            }
        });
    }
});

app.get('/api/v6/animeindo/search', async (req, res) => {
    try {
        const query = req.query.q || req.query.keyword || req.query.search;
        if (!query) {
            return res.status(400).json({
                status: 'error',
                message: 'Parameter q keyword wajib diisi',
                data: {
                    keyword: '',
                    total: 0,
                    results: []
                }
            });
        }
        console.log(`[V6] AnimeIndo API - Search request for: ${query}`);
        const data = await animeIndoScraper.scrapeSearch(query);
        res.json(data);
    } catch (error) {
        console.error('[V6] AnimeIndo API - Search error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to search anime',
            data: {
                keyword: '',
                total: 0,
                results: []
            }
        });
    }
});

// ==================== API V7 - NEKOPOI ====================

function sendV7Maintenance(res) {
    return res.status(503).json({
        status: 'maintenance',
        message: 'V7 Nekopoi sementara maintenance karena source memasang anti-bot.',
        data: null
    });
}

app.get('/api/v7/nekopoi/home', async (req, res) => {
    try {
        const rawPage = parseInt(req.query.page, 10) || 1;
        const page = Math.min(1000, Math.max(1, rawPage));
        console.log(`[V7] Nekopoi API - Home request page ${page}`);
        const data = await nekopoiScraper.scrapeHomepage(page);
        const statusCode = data.status === 'success' ? 200 : 502;
        res.status(statusCode).json(data);
    } catch (error) {
        console.error('[V7] Nekopoi API - Home error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Nekopoi homepage',
            data: null
        });
    }
});

app.get('/api/v7/nekopoi/detail/:slug(*)', async (req, res) => {
    return sendV7Maintenance(res);
});

app.get('/api/v7/nekopoi/episode/:slug(*)', async (req, res) => {
    return sendV7Maintenance(res);
});

app.get('/api/v7/nekopoi/search', async (req, res) => {
    return sendV7Maintenance(res);
});

app.get('/api/v7/nekopoi/hentai-list', async (req, res) => {
    return sendV7Maintenance(res);
});

// Test endpoint to check if streaming URL can be downloaded
app.post('/api/v7/nekopoi/test-download', async (req, res) => {
    return sendV7Maintenance(res);
});

// Proxy endpoint for downloading streaming URLs
app.get('/api/v7/nekopoi/proxy-download', async (req, res) => {
    return sendV7Maintenance(res);
});


// ==================== API V8 - KUSONIME ====================

// GET /api/v8/kusonime/home - Get Kusonime homepage
app.get('/api/v8/kusonime/home', async (req, res) => {
    try {
        const rawPage = parseInt(req.query.page, 10) || 1;
        const page = Math.min(1000, Math.max(1, rawPage));
        const cacheKey = `home:${page}`;

        await sendCachedJson(res, v8KusonimeHomeCache, cacheKey, async () => {
            console.log(`[V8] Kusonime API - Home request page ${page}`);
            return kusonimeScraper.scrapeHome(page);
        });
    } catch (error) {
        console.error('[V8] Kusonime API - Home error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Kusonime homepage',
            data: null
        });
    }
});

app.get('/api/v8/kusonime/anime-list', async (req, res) => {
    try {
        const allowedKinds = new Set(['all', 'bd', 'movie', 'live-action', 'ova', 'special', 'ona']);
        const rawPage = parseInt(req.query.page, 10) || 1;
        const page = Math.min(1000, Math.max(1, rawPage));
        const requestedKind = String(req.query.kind || 'all').toLowerCase();
        const kind = allowedKinds.has(requestedKind) ? requestedKind : 'all';
        const cacheKey = `anime-list:${kind}:${page}`;

        await sendCachedJson(res, v8KusonimeAnimeListCache, cacheKey, async () => {
            console.log(`[V8] Kusonime API - Anime list request kind ${kind} page ${page}`);
            return kusonimeScraper.scrapeAnimeList(page, kind);
        });
    } catch (error) {
        console.error('[V8] Kusonime API - Anime list error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Kusonime anime list',
            data: null
        });
    }
});

app.get('/api/v8/kusonime/genres', async (req, res) => {
    try {
        console.log('[V8] Kusonime API - Genres request');
        const data = await kusonimeScraper.scrapeGenres();
        res.json(data);
    } catch (error) {
        console.error('[V8] Kusonime API - Genres error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Kusonime genres',
            data: null
        });
    }
});

app.get('/api/v8/kusonime/seasons', async (req, res) => {
    try {
        console.log('[V8] Kusonime API - Seasons request');
        const data = await kusonimeScraper.scrapeSeasons();
        res.json(data);
    } catch (error) {
        console.error('[V8] Kusonime API - Seasons error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Kusonime release years',
            data: null
        });
    }
});

app.get('/api/v8/kusonime/genre/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V8] Kusonime API - Genre request ${slug} page ${page}`);
        const data = await kusonimeScraper.scrapeGenre(slug, page);
        res.json(data);
    } catch (error) {
        console.error('[V8] Kusonime API - Genre error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Kusonime genre list',
            data: null
        });
    }
});

app.get('/api/v8/kusonime/season/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const page = parseInt(req.query.page, 10) || 1;
        console.log(`[V8] Kusonime API - Season request ${slug} page ${page}`);
        const data = await kusonimeScraper.scrapeSeason(slug, page);
        res.json(data);
    } catch (error) {
        console.error('[V8] Kusonime API - Season error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Kusonime release year list',
            data: null
        });
    }
});

// GET /api/v8/kusonime/detail/:slug - Get anime detail
app.get('/api/v8/kusonime/detail/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`[V8] Kusonime API - Detail request for: ${slug}`);
        const data = await kusonimeScraper.scrapeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error('[V8] Kusonime API - Detail error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch anime detail',
            data: null
        });
    }
});

// GET /api/v8/kusonime/search - Search anime
app.get('/api/v8/kusonime/search', async (req, res) => {
    try {
        const keyword = req.query.q || req.query.keyword;

        if (!keyword) {
            return res.status(400).json({
                status: 'error',
                message: 'Keyword parameter is required',
                data: null
            });
        }

        console.log(`[V8] Kusonime API - Search request for: ${keyword}`);
        const data = await kusonimeScraper.scrapeSearch(keyword);
        res.json(data);
    } catch (error) {
        console.error('[V8] Kusonime API - Search error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to search anime',
            data: null
        });
    }
});

registerHlsRoutes(app, hlsService);

// ==============================
// Auratail.vip API Routes (V9)
// ==============================

// Auratail Homepage
app.get('/api/v9/auratail/home', async (req, res) => {
    try {
        console.log('[V9] Scraping Auratail homepage...');
        const data = await auratailScraper.scrapeHome();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /home:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Anime Detail
app.get('/api/v9/auratail/anime/:animeId/:slug', async (req, res) => {
    try {
        const { animeId, slug } = req.params;
        console.log(`[V9] Scraping Auratail anime detail: ${animeId}/${slug}`);
        const data = await auratailScraper.scrapeDetail(animeId, slug);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Episode Detail
app.get('/api/v9/auratail/episode/:animeId/:slug/:episodeNum', async (req, res) => {
    try {
        const { animeId, slug, episodeNum } = req.params;
        console.log(`[V9] Scraping Auratail episode: ${animeId}/${slug}/episode/${episodeNum}`);
        const data = await auratailScraper.scrapeEpisode(animeId, slug, episodeNum);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /episode:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Dailymotion Video (for Dailymotion fallback items)
app.get('/api/v9/auratail/video/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        console.log(`[V9] Fetching Dailymotion video: ${videoId}`);
        const data = await auratailScraper.scrapeDailymotionVideo(videoId);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /video:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Search
app.get('/api/v9/auratail/search', async (req, res) => {
    try {
        const { q, page = 1 } = req.query;
        if (!q) {
            return res.status(400).json({ status: 'error', message: 'Query parameter "q" is required' });
        }
        console.log(`[V9] Searching Auratail for: ${q}`);
        const data = await auratailScraper.scrapeSearch(q, page);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /search:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Anime List
app.get('/api/v9/auratail/anime-list', async (req, res) => {
    try {
        const { page = 1, status = '', type = '', order = 'update' } = req.query;
        console.log(`[V9] Fetching Auratail anime list...`);
        const data = await auratailScraper.scrapeAnimeList(page, status, type, order);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /anime-list:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Genres
app.get('/api/v9/auratail/genres', async (req, res) => {
    try {
        console.log('[V9] Fetching Auratail genres...');
        const data = await auratailScraper.scrapeGenreList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /genres:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Genre Detail
app.get('/api/v9/auratail/genre/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { page = 1, orderBy = 'ascending' } = req.query;
        console.log(`[V9] Fetching Auratail genre: ${slug}`);
        const data = await auratailScraper.scrapeGenre(slug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /genre:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Types
app.get('/api/v9/auratail/types', async (req, res) => {
    try {
        console.log('[V9] Fetching Auratail types...');
        const data = await auratailScraper.scrapeTypeList();
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /types:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Type Detail
app.get('/api/v9/auratail/type/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { page = 1, orderBy = 'ascending' } = req.query;
        console.log(`[V9] Fetching Auratail type: ${slug}`);
        const data = await auratailScraper.scrapeType(slug, page, orderBy);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /type:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Auratail Batch Download
app.get('/api/v9/auratail/batch/:animeId/:slug/:range', async (req, res) => {
    try {
        const { animeId, slug, range } = req.params;
        console.log(`[V9] Scraping Auratail batch: ${animeId}/${slug}/batch/${range}`);
        const data = await auratailScraper.scrapeBatch(animeId, slug, range);
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('[V9] API Error /batch:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ========== V10 API: Vidku.me ==========

// GET /api/v10/vidku/home - Get Vidku homepage
app.get('/api/v10/vidku/home', async (req, res) => {
    try {
        console.log('[V10] Scraping Vidku home');
        const data = await vidkuScraper.scrapeHome();
        res.json(data);
    } catch (error) {
        console.error('[V10] API Error /home:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// GET /api/v10/vidku/anime/:slug - Get anime detail
app.get('/api/v10/vidku/anime/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        console.log(`[V10] Scraping Vidku anime detail: ${slug}`);
        const data = await vidkuScraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error('[V10] API Error /anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// GET /api/v10/vidku/episode/:slug - Get episode detail
app.get('/api/v10/vidku/episode/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        console.log(`[V10] Scraping Vidku episode: ${slug}`);
        const data = await vidkuScraper.scrapeEpisode(slug);
        res.json(data);
    } catch (error) {
        console.error('[V10] API Error /episode:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// GET /api/v10/vidku/search - Search anime
app.get('/api/v10/vidku/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ status: 'error', message: 'Query parameter "q" is required' });
        }
        console.log(`[V10] Searching Vidku for: ${q}`);
        const data = await vidkuScraper.scrapeSearch(q);
        res.json(data);
    } catch (error) {
        console.error('[V10] API Error /search:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// GET /api/v10/vidku/anime-list/:page? - Get latest episodes with pagination
app.get('/api/v10/vidku/anime-list/:page?', async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        console.log(`[V10] Scraping Vidku anime list page ${page}`);
        const data = await vidkuScraper.scrapeAnimeList(page);
        res.json(data);
    } catch (error) {
        console.error('[V10] API Error /anime-list:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// GET /api/v10/vidku/schedule - Get release schedule
app.get('/api/v10/vidku/schedule', async (req, res) => {
    try {
        console.log('[V10] Scraping Vidku schedule');
        const data = await vidkuScraper.scrapeSchedule();
        res.json(data);
    } catch (error) {
        console.error('[V10] API Error /schedule:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// GET /api/v10/vidku/all-anime - Get all anime with filters
app.get('/api/v10/vidku/all-anime', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const filters = {};
        
        if (req.query.status) filters.status = req.query.status;
        if (req.query.type) filters.type = req.query.type;
        if (req.query.order) filters.order = req.query.order;
        if (req.query.title) filters.title = req.query.title;
        if (req.query.letter) filters.letter = req.query.letter;
        if (req.query.genre) {
            filters.genre = Array.isArray(req.query.genre) ? req.query.genre : [req.query.genre];
        }
        
        console.log(`[V10] Scraping Vidku all anime page ${page} with filters:`, filters);
        const data = await vidkuScraper.scrapeAllAnime(filters, page);
        res.json(data);
    } catch (error) {
        console.error('[V10] API Error /all-anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// GET /api/v10/vidku/advanced-search/config - Get advanced search filter config
app.get('/api/v10/vidku/advanced-search/config', async (req, res) => {
    try {
        console.log('[V10] Scraping Vidku advanced search config');
        const data = await vidkuScraper.scrapeAdvancedSearchConfig();
        res.json(data);
    } catch (error) {
        console.error('[V10] API Error /advanced-search/config:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// GET /api/v10/vidku/advanced-search - Get advanced search results
app.get('/api/v10/vidku/advanced-search', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const filters = {};

        if (req.query.title) filters.title = req.query.title;
        if (req.query.keyword) filters.keyword = req.query.keyword;
        if (req.query.orderby) filters.orderby = req.query.orderby;
        if (req.query.order) filters.order = req.query.order;

        ['status', 'type', 'genre', 'producer', 'studio', 'season'].forEach((field) => {
            if (!req.query[field]) return;
            filters[field] = Array.isArray(req.query[field]) ? req.query[field] : [req.query[field]];
        });

        console.log(`[V10] Scraping Vidku advanced search page ${page} with filters:`, filters);
        const data = await vidkuScraper.scrapeAdvancedSearch(filters, page);
        res.json(data);
    } catch (error) {
        console.error('[V10] API Error /advanced-search:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});


// 404 handler
app.use((req, res) => {
    res.status(404).send('<h1>404 - Halaman tidak ditemukan</h1><a href="/v1/home">Kembali ke Beranda</a>');
});

// Auto-cleanup cache images older than 1 hour
async function cleanOldCacheImages() {
    try {
        const files = await fs.readdir(CACHE_DIR);
        const now = Date.now();
        const MAX_AGE = 60 * 60 * 1000; // 1 hour in milliseconds
        let deletedCount = 0;
        let deletedSize = 0;

        for (const file of files) {
            const filePath = path.join(CACHE_DIR, file);
            try {
                const stats = await fs.stat(filePath);
                const age = now - stats.mtime.getTime();

                if (age > MAX_AGE) {
                    deletedSize += stats.size;
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            } catch (error) {
                console.error(`[Cache Cleanup] Error processing ${file}:`, error.message);
            }
        }

        if (deletedCount > 0) {
            const deletedMB = (deletedSize / (1024 * 1024)).toFixed(2);
            console.log(`🧹 [Cache Cleanup] Deleted ${deletedCount} old images (${deletedMB} MB)`);
        }
    } catch (error) {
        console.error('[Cache Cleanup] Error:', error.message);
    }
}

// Run cleanup every 10 minutes
setInterval(cleanOldCacheImages, 10 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 AnimMe Server berjalan di http://0.0.0.0:${PORT}`);
    console.log(`📺 Multi-Server Support:`);
    console.log(`   ├─ V1 (Otakudesu): /api/...`);
    console.log(`   ├─ V2 (Samehadaku): /api/v2/...`);
    console.log(`   ├─ V3 (Kuramanime): /api/v3/kuramanime/...`);
    console.log(`   ├─ V4 (Anichin): /api/v4/anichin/...`);
    console.log(`   ├─ V5 (Anoboy): /api/v5/anoboy/...`);
    console.log(`   ├─ V6 (AnimeIndo): /api/v6/animeindo/...`);
    console.log(`   ├─ V7 (Nekopoi): /api/v7/nekopoi/...`);
    console.log(`   ├─ V8 (Kusonime): /api/v8/kusonime/...`);
    console.log(`   ├─ V9 (Auratail): /api/v9/auratail/...`);
    console.log(`   └─ V10 (Vidku): /api/v10/vidku/...`);
    console.log(`🌐 Buka browser dan akses: http://167.253.159.235:${PORT}`);
    console.log(`🧹 Auto-cleanup cache: Images older than 1 hour will be deleted every 10 minutes\n`);

    // Run initial cleanup on server start
    cleanOldCacheImages();
});
