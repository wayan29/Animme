const { BASE_URL, fetchPage, imageProxy, extractSlugFromUrl, cleanText } = require('./helpers');

// Scrape anime detail (series page)
async function scrapeAnimeDetail(slug) {
    try {
        // Nekopoi series URL format: /hentai/series-name/
        const url = slug.includes(BASE_URL) ? slug : `${BASE_URL}/hentai/${slug}/`;
        const $ = await fetchPage(url);

        // Title - extract dari h2 yang berisi "Unduh ... Online"
        let title = cleanText($('.animeinfos h2').first().text());
        // Clean title (remove "Unduh" dan " Indonesian Subbed/Dubbed Online")
        title = title.replace(/^Unduh\s+[""]?|[""]?\s+Indonesian.*$/gi, '').trim();

        // Poster/Thumbnail dari .imgdesc img
        const poster = $('.imgdesc img').first().attr('src');

        // Synopsis dari .desc p
        const synopsis = cleanText($('.imgdesc .desc p').first().text());

        // Latest Episode info
        const latestEpisode = {
            episode: cleanText($('.latestest .latestepisode').text()),
            url: $('.latestest .latestnow a').attr('href')
        };

        // Info details dari .listinfo ul li
        const info = {};
        $('.listinfo ul li').each((_, elem) => {
            const $elem = $(elem);
            const text = $elem.text();
            const labelMatch = text.match(/^([^:]+):\s*(.+)/);

            if (labelMatch) {
                const label = cleanText(labelMatch[1]);
                let value = cleanText(labelMatch[2]);

                // Jangan ambil genre sebagai text, nanti diproses terpisah
                if (!label.toLowerCase().includes('genre')) {
                    info[label] = value;
                }
            }
        });

        // Genres/Tags dari .listinfo a[rel="tag"]
        const genres = [];
        $('.listinfo a[rel="tag"]').each((_, elem) => {
            const $elem = $(elem);
            genres.push({
                name: cleanText($elem.text()),
                slug: extractSlugFromUrl($elem.attr('href')),
                url: $elem.attr('href')
            });
        });

        // Episode List dari .episodelist
        const episodes = [];
        $('.episodelist ul li').each((_, elem) => {
            const $elem = $(elem);
            const episodeTitle = cleanText($elem.find('.leftoff a').text());
            const episodeUrl = $elem.find('.leftoff a').attr('href');
            const releaseDate = cleanText($elem.find('.rightoff').text());

            if (episodeTitle && episodeUrl) {
                episodes.push({
                    title: episodeTitle,
                    slug: extractSlugFromUrl(episodeUrl),
                    url: episodeUrl,
                    releaseDate
                });
            }
        });

        return {
            status: 'success',
            data: {
                title,
                slug,
                poster: imageProxy(poster),
                synopsis,
                info,
                genres,
                latestEpisode,
                episodes,
                totalEpisodes: episodes.length
            }
        };
    } catch (error) {
        return {
            status: 'error',
            message: error.message
        };
    }
}

module.exports = { scrapeAnimeDetail };
