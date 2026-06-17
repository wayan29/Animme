const axios = require('axios');

function registerOtakudesuRoutes(app, deps) {
    const {
        scraper,
        homeCache,
        latestEpisodeCache,
        apiResponseCache,
        scheduleCache,
        resolveStreamUrl
    } = deps;

    const STREAM_RESOLVE_CACHE_TTL_MS = 60 * 1000;

    function normalizeStreamCacheKey(streamUrl) {
        const value = String(streamUrl || '').trim();
        try {
            const parsed = new URL(value);
            parsed.hash = '';
            return `v1:resolve-stream:${parsed.toString()}`;
        } catch (error) {
            return `v1:resolve-stream:${value}`;
        }
    }

    async function resolveStreamUrlCached(streamUrl) {
        if (!streamUrl) return null;
        return apiResponseCache.get(
            normalizeStreamCacheKey(streamUrl),
            STREAM_RESOLVE_CACHE_TTL_MS,
            () => resolveStreamUrl(streamUrl)
        );
    }

    app.get('/api/home', async (req, res) => {
        try {
            const { value, cache } = await homeCache.get(() => {
                console.log('Scraping homepage...');
                return scraper.scrapeHome();
            });
            res.setHeader('X-Cache', cache);
            res.json(value);
        } catch (error) {
            console.error('API Error /home:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/latest-episode/:slug', async (req, res) => {
        try {
            const { slug } = req.params;
            const currentEpisode = req.query.ep || req.query.episode;

            if (!currentEpisode) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Parameter ep wajib diisi'
                });
            }

            const cacheKey = `latest-episode:${slug}:${currentEpisode}`;
            const episodeSlug = await latestEpisodeCache.get(cacheKey, 5 * 60 * 1000, () =>
                scraper.resolveLatestEpisodeSlugForAnime(slug, currentEpisode)
            );

            if (!episodeSlug) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Episode terbaru tidak ditemukan'
                });
            }

            res.json({
                status: 'success',
                data: {
                    anime_slug: slug,
                    current_episode: currentEpisode,
                    episode_slug: episodeSlug
                }
            });
        } catch (error) {
            console.error('API Error /latest-episode:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/anime/:slug', async (req, res) => {
        try {
            const slug = req.params.slug;
            console.log(`Scraping anime detail: ${slug}`);
            const data = await apiResponseCache.get(`v1:anime:${slug}`, 10 * 60 * 1000, () =>
                scraper.scrapeAnimeDetail(slug)
            );
            res.json(data);
        } catch (error) {
            console.error('API Error /anime:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/search/:keyword', async (req, res) => {
        try {
            const keyword = req.params.keyword;
            console.log(`[V1] Searching for: ${keyword}`);
            const data = await scraper.scrapeSearch(keyword);
            res.json(data);
        } catch (error) {
            console.error('[V1] Search error:', error.message);
            res.status(500).json({
                status: 'error',
                message: error.message,
                note: 'Otakudesu (V1) is protected by Cloudflare. Try /api/v2/search or /api/v3/kuramanime/search'
            });
        }
    });

    app.get('/api/ongoing-anime/:page?', async (req, res) => {
        try {
            const page = parseInt(req.params.page) || 1;
            console.log(`Scraping ongoing anime page ${page}`);
            const data = await apiResponseCache.get(`v1:ongoing:${page}`, 5 * 60 * 1000, () =>
                scraper.scrapeOngoingAnime(page)
            );
            res.json(data);
        } catch (error) {
            console.error('API Error /ongoing-anime:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/complete-anime/:page?', async (req, res) => {
        try {
            const page = parseInt(req.params.page) || 1;
            console.log(`Scraping complete anime page ${page}`);
            const data = await apiResponseCache.get(`v1:complete:${page}`, 5 * 60 * 1000, () =>
                scraper.scrapeCompleteAnime(page)
            );
            res.json(data);
        } catch (error) {
            console.error('API Error /complete-anime:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/all-anime', async (req, res) => {
        try {
            console.log('Scraping all anime list...');
            const data = await scraper.scrapeAllAnime();
            res.json(data);
        } catch (error) {
            console.error('API Error /all-anime:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/genres', async (req, res) => {
        try {
            console.log('Scraping genre list...');
            const data = await scraper.scrapeGenreList();
            res.json(data);
        } catch (error) {
            console.error('API Error /genres:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/genre/:slug/:page?', async (req, res) => {
        try {
            const slug = req.params.slug;
            const page = parseInt(req.params.page) || 1;
            console.log(`Scraping genre ${slug} page ${page}`);
            const data = await scraper.scrapeGenreAnime(slug, page);
            res.json(data);
        } catch (error) {
            console.error('API Error /genre:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/episode/:slug', async (req, res) => {
        try {
            const slug = req.params.slug;
            console.log(`Scraping episode: ${slug}`);
            const data = await apiResponseCache.get(`v1:episode:${slug}`, 10 * 60 * 1000, () =>
                scraper.scrapeEpisode(slug)
            );
            res.json(data);
        } catch (error) {
            console.error('API Error /episode:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/batch/:slug', async (req, res) => {
        try {
            const slug = req.params.slug;
            console.log(`Scraping batch: ${slug}`);
            const data = await scraper.scrapeBatch(slug);
            res.json(data);
        } catch (error) {
            console.error('API Error /batch:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/schedule', async (req, res) => {
        try {
            const { value, cache } = await scheduleCache.get(() => {
                console.log('Scraping schedule...');
                return scraper.scrapeSchedule();
            });
            res.setHeader('X-Cache', cache);
            res.json(value);
        } catch (error) {
            console.error('API Error /schedule:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/stream/:postId/:quality/:serverIndex', async (req, res) => {
        try {
            const { postId, quality, serverIndex } = req.params;
            const shouldResolve = req.query.resolve === '1';
            console.log(`Fetching stream URL for post ${postId}, quality ${quality}, server ${serverIndex}`);

            const nonceResponse = await axios.post('https://otakudesu.blog/wp-admin/admin-ajax.php',
                new URLSearchParams({
                    action: 'aa1208d27f29ca340c92c66d1926f13f'
                }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
            );

            const nonce = nonceResponse.data.data;

            if (!nonce) {
                throw new Error('Failed to get nonce');
            }

            const streamResponse = await axios.post('https://otakudesu.blog/wp-admin/admin-ajax.php',
                new URLSearchParams({
                    id: postId,
                    i: serverIndex,
                    q: quality,
                    nonce: nonce,
                    action: '2a3505c93b0035d3f455df82bf976b84'
                }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
            );

            const base64Html = streamResponse.data.data;
            const decodedHtml = Buffer.from(base64Html, 'base64').toString('utf-8');

            const srcMatch = decodedHtml.match(/src="([^"]+)"/);
            const streamUrl = srcMatch ? srcMatch[1] : null;

            if (!streamUrl) {
                throw new Error('Failed to extract stream URL');
            }

            let resolved = null;
            if (shouldResolve) {
                resolved = await resolveStreamUrlCached(streamUrl);
            }

            res.json({
                status: 'success',
                data: {
                    stream_url: streamUrl,
                    quality: quality,
                    server_index: serverIndex,
                    resolved: resolved
                }
            });
        } catch (error) {
            console.error('API Error /stream:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/resolve-stream', async (req, res) => {
        try {
            const rawUrl = req.query.url;
            if (!rawUrl) {
                return res.status(400).json({ status: 'error', message: 'Parameter url wajib diisi' });
            }
            let decodedUrl = rawUrl;
            try {
                decodedUrl = decodeURIComponent(rawUrl);
            } catch (error) {
                // Keep original when decode fails
            }
            let parsedUrl;
            try {
                parsedUrl = new URL(decodedUrl);
            } catch (error) {
                return res.status(400).json({ status: 'error', message: 'URL stream tidak valid' });
            }

            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return res.status(400).json({ status: 'error', message: 'Protocol URL stream tidak didukung' });
            }

            const resolved = await resolveStreamUrlCached(parsedUrl.toString());
            res.json({
                status: 'success',
                data: {
                    stream_url: parsedUrl.toString(),
                    resolved
                }
            });
        } catch (error) {
            console.error('API Error /resolve-stream:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });
}

module.exports = { registerOtakudesuRoutes };