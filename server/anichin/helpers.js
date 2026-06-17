const axios = require('axios');
const ImageProxy = require('../image-proxy');

const BASE_URL = 'https://anichin.cafe';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// Create single ImageProxy instance to be shared across modules
const imageProxy = new ImageProxy();

async function fetchPage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error(`[Anichin] Error fetching ${url}:`, error.message);
        throw new Error(`Failed to fetch page: ${error.message}`);
    }
}

function extractSlugFromUrl(url, baseUrl = BASE_URL) {
    return url.replace(baseUrl, '').replace('/seri/', '').replace('/', '');
}

module.exports = {
    BASE_URL,
    USER_AGENT,
    imageProxy,
    fetchPage,
    extractSlugFromUrl
};
