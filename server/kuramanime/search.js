const cheerio = require('cheerio');
const { BASE_URL, fetchWithPuppeteer, proxyImageUrl, extractSlug, extractAnimeId } = require('./helpers');

async function scrapeSearch(query, page = 1, orderBy = 'ascending') {
    try {
        const url = `${BASE_URL}/anime?search=${encodeURIComponent(query)}&page=${page}&order_by=${orderBy}`;
        const data = await fetchWithPuppeteer(url);
        const $ = cheerio.load(data);
        const results = [];

        $('.product__item').each((i, el) => {
            const $el = $(el);
            const $link = $el.find('a').first();
            const href = $link.attr('href');
            const title = $el.find('.product__item__text h5 a').text().trim();
            const poster = $el.find('.product__item__pic').attr('data-setbg');

            const rating = $el.find('.ep .fa-star').next('span').text().trim();
            const status = $el.find('.d-none span').text().trim() || 'ONGOING';

            const tags = [];
            $el.find('.product__item__text ul a').each((j, tag) => {
                const tagText = $(tag).text().trim();
                const tagHref = $(tag).attr('href');
                if (tagText && tagHref) {
                    tags.push({
                        label: tagText,
                        url: tagHref
                    });
                }
            });

            if (title && href) {
                const animeId = extractAnimeId(href);
                const slug = extractSlug(href);

                results.push({
                    anime_id: animeId,
                    slug: slug,
                    title: title,
                    poster: proxyImageUrl(poster),
                    rating: rating || 'N/A',
                    status: status,
                    tags: tags,
                    anime_url: `${BASE_URL}/anime/${animeId}/${slug}`
                });
            }
        });

        const $pagination = $('.product__pagination');
        let totalPages = null;
        $pagination.find('a').each((i, el) => {
            const pageNum = parseInt($(el).text());
            if (!isNaN(pageNum) && (totalPages === null || pageNum > totalPages)) {
                totalPages = pageNum;
            }
        });

        const hasNext = totalPages ? page < totalPages : false;
        const hasPrev = page > 1;

        return {
            results: results,
            query: query,
            pagination: {
                current_page: page,
                has_next: hasNext,
                has_prev: hasPrev,
                total_pages: totalPages
            },
            total_results: results.length
        };
    } catch (error) {
        console.error('Kuramanime scrapeSearch error:', error.message);
        throw error;
    }
}

module.exports = {
    scrapeSearch
};
