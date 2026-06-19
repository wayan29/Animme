const axios = require('axios');
const { BASE_URL, USER_AGENT, isWafChallengeHtml, extractSlugFromUrl } = require('./helpers');

function isSafeSlug(slug = '') {
    return /^[a-z0-9][a-z0-9_-]{0,220}$/i.test(String(slug || ''));
}

function classifyNekopoiUrl(finalUrl) {
    const parsed = new URL(finalUrl);
    if (parsed.hostname !== new URL(BASE_URL).hostname) return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    const slug = extractSlugFromUrl(parsed.pathname.replace(/\/+$/, ''));
    if (!isSafeSlug(slug)) return null;

    if (segments[0] === 'hentai') {
        return {
            type: 'detail',
            slug,
            path: `/v7/detail?slug=${encodeURIComponent(slug)}`
        };
    }

    if (segments.length === 1) {
        return {
            type: 'episode',
            slug,
            path: `/v7/episode?slug=${encodeURIComponent(slug)}`
        };
    }

    return null;
}

async function scrapeRandom() {
    const sourceUrl = `${BASE_URL}/random`;
    try {
        const response = await axios.get(sourceUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': BASE_URL
            },
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: () => true
        });

        if (response.status >= 400 || isWafChallengeHtml(response.data)) {
            throw new Error(`Failed to fetch ${sourceUrl}: Request failed with status code ${response.status}`);
        }

        const finalUrl = response.request?.res?.responseUrl || sourceUrl;
        const classified = classifyNekopoiUrl(finalUrl);
        if (!classified) {
            return {
                status: 'error',
                message: 'Random target is not a supported Nekopoi detail/episode page',
                data: {
                    sourceUrl,
                    finalUrl
                }
            };
        }

        return {
            status: 'success',
            data: {
                sourceUrl,
                finalUrl,
                ...classified
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

module.exports = { scrapeRandom, classifyNekopoiUrl };
