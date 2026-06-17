const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class ImageProxy {
    constructor() {
        this.cacheDir = path.join(__dirname, '../cache/images');
        this.baseUrl = ''; // Relative path only, no domain
        this.ensureCacheDir();
    }

    async ensureCacheDir() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            console.error('[ImageProxy] Error creating cache directory:', error.message);
        }
    }

    // Generate hash filename for cached image
    getImageHash(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }

    // Get file extension from URL
    getFileExtension(url) {
        const urlPath = new URL(url).pathname;
        const ext = path.extname(urlPath).toLowerCase();
        return ext || '.jpg'; // Default to .jpg if no extension found
    }

    // Download and cache image
    async downloadAndCacheImage(url) {
        try {
            const imageHash = this.getImageHash(url);
            const fileExt = this.getFileExtension(url);
            const fileName = `${imageHash}${fileExt}`;
            const localPath = path.join(this.cacheDir, fileName);
            const localUrl = `/cache/img/${fileName}`;

            // Check if image already exists in cache
            try {
                await fs.access(localPath);
                console.log(`[ImageProxy] Cache hit: ${url}`);
                return localUrl;
            } catch {
                // Image not in cache, download it
                console.log(`[ImageProxy] Downloading: ${url}`);
            }

            // Download image with timeout and proper headers
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'https://anichin.cafe/',
                    'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                }
            });

            // Save to cache
            await fs.writeFile(localPath, response.data);
            console.log(`[ImageProxy] Cached: ${url} -> ${fileName}`);

            return localUrl;
        } catch (error) {
            console.error(`[ImageProxy] Error downloading image ${url}:`, error.message);
            return url; // Return original URL on error
        }
    }

    // Process poster URL and return cached/local URL
    async processPosterUrl(originalUrl) {
        if (!originalUrl || originalUrl.startsWith('http://localhost') || originalUrl.startsWith('/cache/')) {
            return originalUrl; // Already local or invalid
        }

        try {
            return await this.downloadAndCacheImage(originalUrl);
        } catch (error) {
            console.error('[ImageProxy] Error processing poster URL:', error.message);
            return originalUrl; // Return original URL on error
        }
    }

    // Process multiple poster URLs concurrently
    async processPosterUrls(urls) {
        if (!Array.isArray(urls)) {
            return await this.processPosterUrl(urls);
        }

        const promises = urls.map(url => this.processPosterUrl(url));
        return await Promise.all(promises);
    }

    // Clean old cache files (optional - for maintenance)
    async cleanOldCache(maxAge = 60 * 60 * 1000) { // 1 hour default
        try {
            const files = await fs.readdir(this.cacheDir);
            const now = Date.now();

            for (const file of files) {
                const filePath = path.join(this.cacheDir, file);
                const stats = await fs.stat(filePath);

                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.unlink(filePath);
                    console.log(`[ImageProxy] Cleaned old cache file: ${file}`);
                }
            }
        } catch (error) {
            console.error('[ImageProxy] Error cleaning cache:', error.message);
        }
    }

    // Get cache statistics
    async getCacheStats() {
        try {
            const files = await fs.readdir(this.cacheDir);
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(this.cacheDir, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
            }

            return {
                fileCount: files.length,
                totalSize: totalSize,
                totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
            };
        } catch (error) {
            console.error('[ImageProxy] Error getting cache stats:', error.message);
            return { fileCount: 0, totalSize: 0, totalSizeMB: '0.00' };
        }
    }
}

module.exports = ImageProxy;
