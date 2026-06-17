// Kusonime V8 Scraper - Detail Page

const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, proxyImageUrl, extractSlug, cleanText } = require('./helpers');

function parseInfoSection($, $info) {
    const info = {
        values: {},
        genres: []
    };

    $info.find('p').each((_, el) => {
        const $row = $(el);
        const label = cleanText($row.find('b').first().text()).replace(/:$/, '');
        if (!label) {
            return;
        }

        if (label.toLowerCase() === 'genre') {
            $row.find('a').each((__, link) => {
                const genre = cleanText($(link).text());
                if (genre) {
                    info.genres.push(genre);
                }
            });
        }

        const text = cleanText($row.text());
        info.values[label.toLowerCase()] = cleanText(text.replace(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*`, 'i'), ''));
    });

    return info;
}

function extractSynopsis($) {
    const paragraphs = [];

    $('.lexot > p').each((_, el) => {
        const text = cleanText($(el).text().replace(/^[^A-Za-z0-9]*Credit\s*:\s*/i, ''));
        if (!text) {
            return;
        }

        if (/^(Japanese|Genre|Seasons|Producers|Type|Status|Total Episode|Score|Duration|Released on)\s*:/i.test(text)) {
            return;
        }

        if (/^Download\s+/i.test(text) || /Sub Indo MKV/i.test(text) || /Matikan ADBLOCK/i.test(text)) {
            return;
        }

        if (/^Credit\s*:/i.test($(el).text())) {
            return;
        }

        paragraphs.push(text);
    });

    return paragraphs.join('\n\n');
}

async function scrapeDetail(slug) {
    try {
        const url = `${BASE_URL}/${slug}/`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const result = {};

        // Get title
        result.title = cleanText($('.venser h1, .entry-title, h1.title').first().text()) ||
            cleanText($('title').text().replace(/\|\s*Kusonime.*$/i, ''));

        // Get poster
        const $img = $('.venser .post-thumb img, .post-thumb img, .wp-post-image, .attachment-post-thumbnail').first();
        result.poster = proxyImageUrl($img.attr('src') || $img.attr('data-src'));

        // Get info from info section
        const $info = $('.info');
        const info = parseInfoSection($, $info);

        // Extract various metadata
        result.japanese_title = info.values['japanese'] || '';
        result.genres = info.genres;

        result.season = info.values['seasons'] || info.values['season'] || '';
        result.producer = info.values['producers'] || info.values['produser'] || '';
        result.type = info.values['type'] || '';
        result.status = info.values['status'] || '';
        result.total_episode = info.values['total episode'] || '';
        result.score = info.values['score'] || '';
        result.duration = info.values['duration'] || '';
        result.release_date = info.values['released on'] || '';

        // Get synopsis
        result.synopsis = extractSynopsis($);

        // Get download links
        result.download_links = {};
        $('.dlbodz .smokeurlrh, .download-link, .smokeddl .smokeurl, .soraddl .smokeurl').each((i, section) => {
            const $section = $(section);
            const quality = cleanText($section.find('strong').first().text());

            const links = [];
            $section.find('a').each((j, link) => {
                const $link = $(link);
                const href = $link.attr('href');
                const host = cleanText($link.text());

                if (!href || href === '#' || !host || /Tampilkan Komentar/i.test(host)) {
                    return;
                }

                links.push({
                    host,
                    url: href
                });
            });

            if (quality && links.length > 0) {
                result.download_links[quality] = links;
            }
        });

        return {
            status: 'success',
            data: result
        };
    } catch (error) {
        console.error('[Kusonime] Error scraping detail:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeDetail
};
