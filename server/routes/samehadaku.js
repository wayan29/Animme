function registerSamehadakuRoutes(app, deps) {
    const { samehadakuScraper, v2HomeCache } = deps;

    app.get('/api/v2/home', async (req, res) => {
        try {
            const { value, cache } = await v2HomeCache.get(() => {
                console.log('[V2] Scraping samehadaku homepage...');
                return samehadakuScraper.scrapeHome();
            });
            res.setHeader('X-Cache', cache);
            res.json(value);
        } catch (error) {
            console.error('[V2] API Error /home:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/v2/anime/:slug', async (req, res) => {
        try {
            const slug = req.params.slug;
            console.log(`[V2] Scraping samehadaku anime detail: ${slug}`);
            const data = await samehadakuScraper.scrapeAnimeDetail(slug);
            res.json(data);
        } catch (error) {
            console.error('[V2] API Error /anime:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/v2/player-stream', async (req, res) => {
        try {
            const postId = req.query.post || req.query.postId;
            const nume = req.query.nume || '1';
            const type = req.query.type || 'schtml';

            if (!postId) {
                return res.status(400).json({ status: 'error', message: 'Parameter post wajib diisi' });
            }

            console.log(`[V2] Fetching Samehadaku player iframe post=${postId}, nume=${nume}, type=${type}`);
            const iframeSrc = await samehadakuScraper.fetchAjaxPlayerIframe({ post: postId, nume, type });

            if (!iframeSrc) {
                return res.status(404).json({ status: 'error', message: 'Stream tidak ditemukan' });
            }

            res.json({
                status: 'success',
                data: {
                    stream_url: iframeSrc,
                    post_id: postId,
                    nume,
                    type
                }
            });
        } catch (error) {
            console.error('[V2] API Error /player-stream:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/v2/search/:keyword', async (req, res) => {
        try {
            const keyword = req.params.keyword;
            console.log(`[V2] Searching samehadaku for: ${keyword}`);
            const data = await samehadakuScraper.scrapeSearch(keyword);
            res.json(data);
        } catch (error) {
            console.error('[V2] API Error /search:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/v2/anime-list/:page?', async (req, res) => {
        try {
            const page = parseInt(req.params.page) || 1;
            console.log(`[V2] Scraping samehadaku anime list page ${page}`);
            const data = await samehadakuScraper.scrapeAnimeList(page);
            res.json(data);
        } catch (error) {
            console.error('[V2] API Error /anime-list:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/v2/terbaru/:page?', async (req, res) => {
        try {
            const page = parseInt(req.params.page) || 1;
            const pagesToLoad = parseInt(req.query.pages) || 1;

            console.log(`[V2] Scraping samehadaku anime terbaru, page ${page}, loading ${pagesToLoad} pages`);

            if (pagesToLoad === 1) {
                const data = await samehadakuScraper.scrapeAnimeList(page);
                if (data.status === 'success' && data.data.paginationData) {
                    data.data.paginationData.items_per_page = 16;
                    data.data.paginationData.total_items = data.data.animeData.length;
                }
                res.json(data);
            } else {
                const allAnimeData = [];
                let basePaginationData = null;

                for (let i = 0; i < pagesToLoad; i++) {
                    const currentPageNum = page + i;
                    try {
                        const data = await samehadakuScraper.scrapeAnimeList(currentPageNum);
                        if (data.status === 'success' && data.data.animeData) {
                            allAnimeData.push(...data.data.animeData);

                            if (basePaginationData === null) {
                                basePaginationData = data.data.paginationData;
                            }

                            if (!data.data.paginationData.has_next_page) {
                                break;
                            }
                        }
                    } catch (error) {
                        console.warn(`[V2] Failed to load page ${currentPageNum}:`, error.message);
                        break;
                    }
                }

                const totalPages = basePaginationData ? Math.ceil(basePaginationData.last_page / pagesToLoad) : 1;
                const currentPageAdjusted = Math.ceil(page / pagesToLoad);
                const hasNextPageAdjusted = (currentPageAdjusted * pagesToLoad) < basePaginationData.last_page;

                res.json({
                    status: 'success',
                    data: {
                        animeData: allAnimeData,
                        paginationData: {
                            current_page: currentPageAdjusted,
                            last_page: totalPages,
                            total_pages: totalPages,
                            has_next_page: hasNextPageAdjusted,
                            has_previous_page: currentPageAdjusted > 1,
                            next_page: currentPageAdjusted + 1,
                            previous_page: currentPageAdjusted - 1,
                            items_per_page: pagesToLoad * 16,
                            total_items: allAnimeData.length,
                            original_pagination: basePaginationData
                        }
                    }
                });
            }
        } catch (error) {
            console.error('[V2] API Error /terbaru:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/v2/all-anime', async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const filters = {
                title: req.query.title || '',
                status: req.query.status || '',
                type: req.query.type || '',
                order: req.query.order || 'title',
                genre: req.query.genre ? (Array.isArray(req.query.genre) ? req.query.genre : [req.query.genre]) : []
            };

            console.log(`[V2] Scraping samehadaku all anime page ${page} with filters:`, filters);
            const data = await samehadakuScraper.scrapeAllAnime(filters, page);
            res.json(data);
        } catch (error) {
            console.error('[V2] API Error /all-anime:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/v2/schedule', async (req, res) => {
        try {
            console.log('[V2] Scraping samehadaku schedule...');
            const data = await samehadakuScraper.scrapeSchedule();
            res.json(data);
        } catch (error) {
            console.error('[V2] API Error /schedule:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.get('/api/v2/episode/:slug', async (req, res) => {
        try {
            const slug = req.params.slug;
            console.log(`[V2] Scraping samehadaku episode: ${slug}`);
            const data = await samehadakuScraper.scrapeEpisode(slug);
            res.json(data);
        } catch (error) {
            console.error('[V2] API Error /episode:', error.message);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });
}

module.exports = { registerSamehadakuRoutes };