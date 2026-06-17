const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 5000;
const CACHE_DIR = path.join(__dirname, '../cache/images');

// Ensure cache directory exists
fs.mkdir(CACHE_DIR, { recursive: true }).catch(console.error);

// Serve static files FIRST (important for .js, .css, etc)
app.use(express.static(path.join(__dirname, '../public')));

// Helper: Generate hash from URL
function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex');
}

// Helper: Get file extension from URL or content-type
function getFileExtension(url, contentType) {
    const urlExt = path.extname(new URL(url).pathname).toLowerCase();
    if (urlExt && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(urlExt)) {
        return urlExt;
    }
    
    if (contentType) {
        const typeMap = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp'
        };
        return typeMap[contentType] || '.jpg';
    }
    
    return '.jpg';
}

// Serve cached images with auto-download - URL SEPENUHNYA TERSEMBUNYI
app.get('/img/:hash', async (req, res) => {
    try {
        const hash = req.params.hash;
        
        // Try to find cached file
        const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        let filePath = null;
        
        for (const ext of extensions) {
            const testPath = path.join(CACHE_DIR, hash + ext);
            try {
                await fs.access(testPath);
                filePath = testPath;
                break;
            } catch (e) {
                // Continue checking
            }
        }
        
        // If cached, serve immediately
        if (filePath) {
            const ext = path.extname(filePath);
            const contentTypeMap = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            };
            
            res.set('Content-Type', contentTypeMap[ext] || 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
            
            const imageBuffer = await fs.readFile(filePath);
            return res.send(imageBuffer);
        }
        
        // Not cached - need original URL to download
        const imageUrlMap = scraper.getImageUrlMap();
        const originalUrl = imageUrlMap.get(hash);
        
        if (!originalUrl) {
            return res.status(404).send('Image not found and no URL mapping');
        }
        
        // Download and cache
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://otakudesu.blog/'
            },
            timeout: 10000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        const ext = getFileExtension(originalUrl, contentType);
        const newFilePath = path.join(CACHE_DIR, hash + ext);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(newFilePath, buffer);
        
        console.log(`✓ Downloaded & cached: ${hash}${ext}`);
        
        res.set('Content-Type', contentType || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(buffer);
    } catch (error) {
        console.error('Image serve error:', error.message);
        res.status(500).send('Failed to load image');
    }
});

// API Endpoints - Using Scraper
app.get('/api/home', async (req, res) => {
    try {
        console.log('Scraping homepage...');
        const data = await scraper.scrapeHome();
        res.json(data);
    } catch (error) {
        console.error('API Error /home:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/anime/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log(`Scraping anime detail: ${slug}`);
        const data = await scraper.scrapeAnimeDetail(slug);
        res.json(data);
    } catch (error) {
        console.error('API Error /anime:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/search/:keyword', async (req, res) => {
    try {
        const keyword = req.params.keyword;
        console.log(`Searching for: ${keyword}`);
        const data = await scraper.scrapeSearch(keyword);
        res.json(data);
    } catch (error) {
        console.error('API Error /search:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/ongoing-anime/:page?', async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        console.log(`Scraping ongoing anime page ${page}`);
        const data = await scraper.scrapeOngoingAnime(page);
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
        const data = await scraper.scrapeCompleteAnime(page);
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
        const data = await scraper.scrapeEpisode(slug);
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
        console.log('Scraping schedule...');
        const data = await scraper.scrapeSchedule();
        res.json(data);
    } catch (error) {
        console.error('API Error /schedule:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Route untuk halaman utama
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Clean URL routes with path parameters
// IMPORTANT: These must exclude files with extensions
app.get('/detail/:slug([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/detail.html'));
});

app.get('/player/:episode([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/player.html'));
});

app.get('/batch/:slug([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/batch.html'));
});

app.get('/genre/:slug([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/genre.html'));
});

app.get('/search/:keyword([^.]+)', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/search.html'));
});

// Static routes (no parameters)
const createRoutes = (routePath, fileName) => {
    const filePath = path.join(__dirname, `../public/${fileName}.html`);
    app.get(`/${routePath}`, (req, res) => res.sendFile(filePath));
    app.get(`/${routePath}.html`, (req, res) => res.sendFile(filePath));
};

createRoutes('schedule', 'schedule');
createRoutes('completed', 'completed');
createRoutes('ongoing', 'ongoing');
createRoutes('genres', 'genres');
createRoutes('all-anime', 'all-anime');

// 404 handler
app.use((req, res) => {
    res.status(404).send('<h1>404 - Halaman tidak ditemukan</h1><a href="/">Kembali ke Beranda</a>');
});

app.listen(PORT, () => {
    console.log(`\n🚀 AnimMe Server (Scraper Mode) berjalan di http://localhost:${PORT}`);
    console.log(`📺 Menggunakan scraper langsung dari otakudesu.blog`);
    console.log(`💾 Backup: server/server.js.backup\n`);
});
