const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs').promises;
const dns = require('dns').promises;
const net = require('net');

function createSharedRoutes({
    cacheDir,
    defaultRequestHeaders,
    itagQualityMap,
    scrapers
}) {
    function getImageHash(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }

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

    function buildRequestHeaders(customHeaders = {}, refererUrl = '') {
        const headers = { ...defaultRequestHeaders, ...customHeaders };
        if (refererUrl) {
            headers.Referer = refererUrl;
        } else if (!headers.Referer) {
            headers.Referer = 'https://otakudesu.blog/';
        }
        return headers;
    }

    async function fetchHtmlContent(url, options = {}) {
        const headers = buildRequestHeaders(options.headers || {}, options.referer);
        const response = await axios.get(url, {
            headers,
            timeout: options.timeout || 12000,
            responseType: 'text'
        });
        return response.data;
    }

    function normalizeUrl(value, baseUrl) {
        if (!value) return null;
        try {
            if (value.startsWith('//')) {
                return `https:${value}`;
            }
            return new URL(value, baseUrl).toString();
        } catch (error) {
            return value;
        }
    }

    function isPrivateIp(address) {
        if (!address) return true;

        if (net.isIPv4(address)) {
            const parts = address.split('.').map(Number);
            return parts[0] === 10
                || parts[0] === 127
                || parts[0] === 0
                || (parts[0] === 169 && parts[1] === 254)
                || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
                || (parts[0] === 192 && parts[1] === 168)
                || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
        }

        if (net.isIPv6(address)) {
            const normalized = address.toLowerCase();
            return normalized === '::1'
                || normalized === '::'
                || normalized.startsWith('fc')
                || normalized.startsWith('fd')
                || normalized.startsWith('fe80:');
        }

        return true;
    }

    async function assertPublicProxyTarget(parsedUrl) {
        const hostname = parsedUrl.hostname.toLowerCase();

        if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
            throw new Error('Blocked private media host');
        }

        if (net.isIP(hostname)) {
            if (isPrivateIp(hostname)) {
                throw new Error('Blocked private media host');
            }
            return;
        }

        const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
        if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
            throw new Error('Blocked private media host');
        }
    }

    function resolveRedirectUrl(location, currentUrl) {
        if (!location) return null;
        try {
            const nextUrl = new URL(location, currentUrl);
            return ['http:', 'https:'].includes(nextUrl.protocol) ? nextUrl : null;
        } catch (error) {
            return null;
        }
    }

    async function fetchWithValidatedRedirects(initialUrl, axiosOptions = {}, maxRedirects = 5) {
        let currentUrl = initialUrl.toString();

        for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
            const parsedCurrentUrl = new URL(currentUrl);
            await assertPublicProxyTarget(parsedCurrentUrl);

            const response = await axios.get(currentUrl, {
                ...axiosOptions,
                maxRedirects: 0,
                validateStatus: () => true
            });

            if (![301, 302, 303, 307, 308].includes(response.status)) {
                response.finalUrl = currentUrl;
                return response;
            }

            const nextUrl = resolveRedirectUrl(response.headers.location, currentUrl);
            response.data?.destroy?.();

            if (!nextUrl) {
                const error = new Error('Invalid redirect target');
                error.statusCode = 400;
                throw error;
            }

            await assertPublicProxyTarget(nextUrl);
            currentUrl = nextUrl.toString();
        }

        const error = new Error('Too many redirects');
        error.statusCode = 508;
        throw error;
    }

    function rewriteDashManifest(manifestContent, sourceUrl) {
        if (!manifestContent) return manifestContent;

        const rewriteValue = (value) => {
            const trimmedValue = String(value || '').trim();
            if (!trimmedValue || /^https?:\/\//i.test(trimmedValue) || /^data:/i.test(trimmedValue)) {
                return trimmedValue;
            }
            return normalizeUrl(trimmedValue, sourceUrl) || trimmedValue;
        };

        return manifestContent
            .replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (_, value) => `<BaseURL>${rewriteValue(value)}</BaseURL>`)
            .replace(/\b(initialization|media|sourceURL|index|href)="([^"]+)"/g, (_, attr, value) => `${attr}="${rewriteValue(value)}"`);
    }

    function extractIframeSource(html, baseUrl) {
        if (!html) return null;
        try {
            const $ = cheerio.load(html);
            const iframe = $('iframe').first();
            if (!iframe || iframe.length === 0) return null;
            const srcAttr = iframe.attr('src') || iframe.attr('data-src');
            if (!srcAttr || srcAttr === 'about:blank') return null;
            return normalizeUrl(srcAttr.trim(), baseUrl);
        } catch (error) {
            return null;
        }
    }

    function extractMimeFromUrl(url) {
        if (!url) return null;
        try {
            const parsed = new URL(url);
            const mime = parsed.searchParams.get('mime');
            return mime ? decodeURIComponent(mime) : null;
        } catch (error) {
            return null;
        }
    }

    function mapItagToQuality(formatId) {
        if (!formatId) return null;
        if (itagQualityMap[formatId]) return itagQualityMap[formatId];
        if (/^\d+$/.test(formatId)) {
            return `${formatId}p`;
        }
        return formatId;
    }

    function extractBloggerVideoFromHtml(html) {
        if (!html) return null;
        const match = html.match(/var\s+VIDEO_CONFIG\s*=\s*(\{[\s\S]*?\});/);
        if (!match) return null;
        try {
            const config = JSON.parse(match[1]);
            const streams = Array.isArray(config.streams) ? config.streams : [];
            const sources = streams.map((stream) => {
                if (!stream.play_url) return null;
                return {
                    url: stream.play_url,
                    mime: stream.mime || extractMimeFromUrl(stream.play_url),
                    format_id: stream.format_id || null,
                    quality: stream.quality || mapItagToQuality(stream.format_id) || null,
                    label: stream.label || mapItagToQuality(stream.format_id) || null
                };
            }).filter(Boolean);
            if (!sources.length) return null;
            return {
                type: 'video',
                provider: 'blogger',
                poster: config.thumbnail || null,
                sources
            };
        } catch (error) {
            console.warn('VIDEO_CONFIG parse error:', error.message);
            return null;
        }
    }

    async function tryJsonVideoEndpoint(streamUrl) {
        try {
            const separator = streamUrl.includes('?') ? '&' : '?';
            const jsonUrl = `${streamUrl}${separator}mode=json&_=${Date.now()}`;
            const response = await axios.get(jsonUrl, {
                headers: buildRequestHeaders({}, streamUrl),
                timeout: 8000
            });
            if (response.data && response.data.video) {
                return normalizeUrl(response.data.video, streamUrl);
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    async function resolveStreamUrl(streamUrl, depth = 0, visited = new Set()) {
        if (!streamUrl || depth > 4 || visited.has(streamUrl)) {
            return null;
        }
        visited.add(streamUrl);
        let html;
        try {
            html = await fetchHtmlContent(streamUrl, { referer: 'https://otakudesu.blog/' });
        } catch (error) {
            console.warn('Failed to fetch stream html:', error.message);
            return null;
        }
        const bloggerVideo = extractBloggerVideoFromHtml(html);
        if (bloggerVideo) {
            return bloggerVideo;
        }
        const iframeSrc = extractIframeSource(html, streamUrl);
        if (iframeSrc) {
            const nested = await resolveStreamUrl(iframeSrc, depth + 1, visited);
            if (nested) {
                return nested;
            }
        }
        const jsonSrc = await tryJsonVideoEndpoint(streamUrl);
        if (jsonSrc) {
            const nestedFromJson = await resolveStreamUrl(jsonSrc, depth + 1, visited);
            if (nestedFromJson) {
                return nestedFromJson;
            }
        }
        return null;
    }

    function register(app) {
        app.get('/api/media-proxy', async (req, res) => {
            const sourceUrl = req.query.url;
            const refererUrl = req.query.referer || 'https://vidku.me/';

            if (!sourceUrl) {
                return res.status(400).json({ status: 'error', message: 'Missing media url' });
            }

            let parsedUrl;
            try {
                parsedUrl = new URL(sourceUrl);
            } catch (error) {
                return res.status(400).json({ status: 'error', message: 'Invalid media url' });
            }

            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return res.status(400).json({ status: 'error', message: 'Unsupported protocol' });
            }

            try {
                await assertPublicProxyTarget(parsedUrl);
            } catch (error) {
                return res.status(400).json({ status: 'error', message: error.message });
            }

            try {
                const isDashManifest = /\.mpd$/i.test(parsedUrl.pathname);

                if (isDashManifest) {
                    const upstream = await fetchWithValidatedRedirects(parsedUrl, {
                        responseType: 'text',
                        timeout: 25000,
                        headers: buildRequestHeaders({
                            Accept: 'application/dash+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
                            Origin: (() => {
                                try {
                                    return new URL(refererUrl).origin;
                                } catch (error) {
                                    return parsedUrl.origin;
                                }
                            })()
                        }, refererUrl)
                    });

                    if (upstream.status >= 400) {
                        return res.status(upstream.status).json({
                            status: 'error',
                            message: `Upstream responded with status ${upstream.status}`
                        });
                    }

                    res.setHeader('Content-Type', 'application/dash+xml; charset=utf-8');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                    return res.status(upstream.status).send(rewriteDashManifest(upstream.data, upstream.finalUrl || parsedUrl.toString()));
                }

                const upstream = await fetchWithValidatedRedirects(parsedUrl, {
                    responseType: 'stream',
                    timeout: 25000,
                    headers: buildRequestHeaders({
                        Accept: '*/*',
                        Origin: (() => {
                            try {
                                return new URL(refererUrl).origin;
                            } catch (error) {
                                return parsedUrl.origin;
                            }
                        })(),
                        ...(req.headers.range ? { Range: req.headers.range } : {})
                    }, refererUrl)
                });

                if (upstream.status >= 400) {
                    upstream.data?.destroy?.();
                    return res.status(upstream.status).json({
                        status: 'error',
                        message: `Upstream responded with status ${upstream.status}`
                    });
                }

                [
                    'content-type',
                    'content-length',
                    'content-range',
                    'accept-ranges',
                    'cache-control',
                    'last-modified',
                    'etag'
                ].forEach((headerName) => {
                    const headerValue = upstream.headers[headerName];
                    if (headerValue) {
                        res.setHeader(headerName, headerValue);
                    }
                });

                res.setHeader('Access-Control-Allow-Origin', '*');
                res.status(upstream.status);
                upstream.data.pipe(res);
            } catch (error) {
                console.error('[Media Proxy] Error fetching media:', error.message);
                const statusCode = error.statusCode || (/Blocked private media host|Unsupported protocol/.test(error.message) ? 400 : 502);
                res.status(statusCode).json({
                    status: 'error',
                    message: statusCode === 400 ? error.message : 'Failed to proxy media'
                });
            }
        });

        app.get('/cache/img/:filename', async (req, res) => {
            try {
                const filename = req.params.filename;
                const imagePath = path.join(cacheDir, filename);
                await fs.access(imagePath);

                const ext = path.extname(filename).toLowerCase();
                const contentType = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.webp': 'image/webp',
                    '.gif': 'image/gif'
                }[ext] || 'image/jpeg';

                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.sendFile(imagePath);
            } catch (error) {
                res.status(404).send('Image not found');
            }
        });

        app.get('/img/:hash', async (req, res) => {
            try {
                const hash = req.params.hash;
                const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                let filePath = null;

                for (const ext of extensions) {
                    const testPath = path.join(cacheDir, hash + ext);
                    try {
                        await fs.access(testPath);
                        filePath = testPath;
                        break;
                    } catch (error) {
                    }
                }

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
                    res.set('Cache-Control', 'public, max-age=31536000');
                    const imageBuffer = await fs.readFile(filePath);
                    return res.send(imageBuffer);
                }

                let originalUrl = null;
                for (const scraper of scrapers) {
                    const imageMap = scraper?.getImageUrlMap?.();
                    if (imageMap?.get) {
                        originalUrl = imageMap.get(hash);
                    }
                    if (originalUrl) break;
                }

                if (!originalUrl) {
                    return res.status(404).send('Image not found and no URL mapping');
                }

                let refererHeader = 'https://otakudesu.blog/';
                try {
                    const parsedUrl = new URL(originalUrl);
                    refererHeader = `${parsedUrl.origin}/`;
                } catch (error) {
                }

                const fetch = (await import('node-fetch')).default;
                const response = await fetch(originalUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        Referer: refererHeader
                    },
                    timeout: 10000
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const contentType = response.headers.get('content-type');
                const ext = getFileExtension(originalUrl, contentType);
                const newFilePath = path.join(cacheDir, hash + ext);
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
    }

    return {
        register,
        helpers: {
            getImageHash,
            getFileExtension,
            buildRequestHeaders,
            fetchHtmlContent,
            normalizeUrl,
            rewriteDashManifest,
            extractIframeSource,
            extractMimeFromUrl,
            mapItagToQuality,
            extractBloggerVideoFromHtml,
            tryJsonVideoEndpoint,
            resolveStreamUrl
        }
    };
}

module.exports = {
    createSharedRoutes
};
