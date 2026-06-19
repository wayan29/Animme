const { BASE_URL, fetchPage, imageProxy, cleanText } = require('./helpers');

function isLikelyContentImage(url = '', alt = '') {
    const text = `${url} ${alt}`.toLowerCase();
    if (!url) return false;
    if (/\.(svg|ico)(\?|$)/i.test(url)) return false;
    if (/(logo|avatar|icon|banner|discord|telegram|facebook|twitter|pixel|tracking|histats|counter|doubleclick|adserver)/i.test(text)) return false;
    return true;
}

function extractImageUrl($img) {
    return $img.attr('src')
        || $img.attr('data-src')
        || $img.attr('data-lazy-src')
        || $img.attr('data-original')
        || '';
}

async function scrapeSchedule() {
    const sourceUrl = `${BASE_URL}/jadwal-new-hentai/`;
    try {
        const $ = await fetchPage(sourceUrl);
        const title = cleanText($('.nk-section-header h1').first().text() || $('h1').first().text() || 'Jadwal New Hentai');
        const images = [];
        const seen = new Set();

        const selectors = [
            'img.alignnone[class*="wp-image"]',
            '.entry-content img',
            '.post-content img',
            '.nk-main-content img',
            'article img',
            '.content img'
        ].join(', ');

        $(selectors).each((_, img) => {
            const $img = $(img);
            const rawUrl = extractImageUrl($img);
            const alt = cleanText($img.attr('alt') || title);
            if (!isLikelyContentImage(rawUrl, alt) || seen.has(rawUrl)) return;

            const src = imageProxy(rawUrl);
            if (!src) return;
            seen.add(rawUrl);
            images.push({ src, alt });
        });

        if (images.length === 0) {
            $('img').each((_, img) => {
                const $img = $(img);
                const rawUrl = extractImageUrl($img);
                const alt = cleanText($img.attr('alt') || title);
                if (!isLikelyContentImage(rawUrl, alt) || seen.has(rawUrl)) return;

                const src = imageProxy(rawUrl);
                if (!src) return;
                seen.add(rawUrl);
                images.push({ src, alt });
            });
        }

        return {
            status: 'success',
            data: {
                title,
                sourceUrl,
                images,
                totalImages: images.length
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message,
            data: null
        };
    }
}

module.exports = { scrapeSchedule };
