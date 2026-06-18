const cheerio = require('cheerio')

const {
    KIRANIME_API_BASE_URL,
    decodeHtml,
    fetchDocument,
    fetchHtml,
    fetchJson,
    fetchWpCollection,
    extractDuration,
    extractUpdatedDate,
    fetchWpSingle,
    getEmbeddedTerms,
    getFeaturedImage,
    getTermName,
    extractAnimeTitleFromEpisodeTitle,
    extractEpisodeNumber,
    extractSlug,
    mapWpAnimeItem,
    mapWpEpisodeItem,
    normalizeUrl,
    normalizeText,
    parseInfoList,
    parsePlayerData,
    proxyImageUrl,
    stripHtml
} = require('./helpers')

const SCHEDULE_DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']

async function fetchPopularAnime(by, limit = 10) {
    const popular = await fetchJson(`${KIRANIME_API_BASE_URL}/anime/popular`, {
        params: { by }
    })

    const ids = popular
        .map((entry) => entry.anime_id)
        .filter(Boolean)
        .slice(0, limit)

    if (ids.length === 0) return []

    const { items } = await fetchWpCollection('anime', {
        include: ids.join(','),
        orderby: 'include',
        per_page: ids.length,
        _embed: 1
    })

    const itemMap = new Map(items.map((item) => [item.id, item]))

    return ids
        .map((id) => itemMap.get(id))
        .filter(Boolean)
        .map((item) => mapWpAnimeItem(item))
}

async function fetchWeeklySchedule() {
    const entries = await Promise.allSettled(
        SCHEDULE_DAYS.map(async (day) => {
            const schedule = await fetchJson(`${KIRANIME_API_BASE_URL}/schedule/day`, {
                params: { day }
            })

            return {
                day,
                schedule: Array.isArray(schedule) ? schedule : []
            }
        })
    )

    return entries.reduce((result, entry) => {
        if (entry.status !== 'fulfilled') return result
        if (entry.value.schedule.length === 0) return result

        result[entry.value.day] = entry.value.schedule.map((item) => ({
            title: decodeHtml(item.title || ''),
            slug: extractSlug(item.url),
            episode_number: item.episode_number || '',
            scheduled_time: item.scheduled_time || '',
            poster: proxyImageUrl(item.thumbnail || ''),
            score: item.score || '',
            type: item.type || '',
            url: normalizeUrl(item.url),
            episode_url: normalizeUrl(item.episode_url)
        }))

        return result
    }, {})
}

async function scrapeHome() {
    try {
        const [trending, airingArchive, latestEpisodes, schedule, featured] = await Promise.all([
            scrapeHomepageTrending(),
            scrapeHomepageAiring(),
            scrapeHomepageLatestEpisodes(),
            fetchWeeklySchedule(),
            scrapeFeaturedSpotlight()
        ])

        return {
            status: 'success',
            data: {
                featured,
                trending,
                airing: airingArchive,
                latest_episodes: latestEpisodes,
                schedule
            }
        }
    } catch (error) {
        console.error('Error scraping vidku home:', error.message)
        throw error
    }
}

function extractSlideImage($slide) {
    const $image = $slide.find('img').first()
    const sourceSet = $image.attr('data-srcset') || $image.attr('srcset') || ''
    const firstSource = sourceSet
        .split(',')
        .map((entry) => entry.trim().split(/\s+/)[0])
        .find(Boolean)
    const styleImage = ($slide.attr('style') || '').match(/url\((['"]?)(.*?)\1\)/)?.[2]

    return normalizeUrl(
        $image.attr('data-src') ||
        $image.attr('data-lazy-src') ||
        $image.attr('data-original') ||
        firstSource ||
        $image.attr('src') ||
        styleImage ||
        ''
    )
}

function uniqueNormalized(values = []) {
    return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))]
}

async function scrapeFeaturedSpotlight() {
    const $ = await fetchDocument('https://vidku.me/')
    let $slides = $('.swiper.swiper-spotlight .swiper-slide, .swiper-spotlight .swiper-slide, [class*="spotlight"] .swiper-slide, [class*="Spotlight"] .swiper-slide')

    if ($slides.length === 0) {
        $slides = $('.swiper-slide').filter((_, element) => {
            const $slide = $(element)
            return $slide.find('img').length > 0 && $slide.find('a[href*="/anime/"], a[href*="/watch/"]').length > 0
        })
    }

    const slides = $slides.map((index, element) => {
        const $slide = $(element)
        const links = uniqueNormalized($slide.find('a[href]').map((_, link) => normalizeUrl($(link).attr('href') || '')).get())
        const watchHref = links.find((href) => /\/watch\//i.test(href)) || ''
        const detailHref = links.find((href) => /\/anime\//i.test(href)) || ''
        const primaryHref = detailHref || watchHref || links[0] || ''
        const slug = extractSlug(primaryHref)
        const $image = $slide.find('img').first()
        const title = normalizeText(
            $slide.find('h1, h2, h3').first().text() ||
            $slide.find('[class*="line-clamp"]').first().text() ||
            $image.attr('alt') ||
            ''
        )
        const label = normalizeText($slide.find('.text-accent, [class*="accent"]').first().text()) || `#${index + 1} Sorotan Utama`
        const description = normalizeText(
            $slide.find('p').first().text() ||
            $slide.find('[class*="line-clamp-3"], [class*="line-clamp-4"]').first().text() ||
            ''
        )
        const meta = uniqueNormalized(
            $slide.find('.hidden.md\\:flex div, .hidden.md\\:flex span, [class*="badge"], [class*="rounded"]')
                .map((_, badge) => $(badge).text())
                .get()
        ).filter((text) => text !== title && text !== label)
        const qualities = meta.filter((text) => /^(HD|FHD|SD|CAM|WEB|BluRay|BD|TV|Movie|ONA|OVA|Special)$/i.test(text))

        if (!slug || !title) return null

        return {
            title,
            slug,
            poster: proxyImageUrl(extractSlideImage($slide)),
            label,
            description,
            meta,
            qualities,
            watch_url: watchHref,
            detail_url: detailHref || `${normalizeUrl('/anime/')}${slug}/`
        }
    }).get().filter(Boolean)

    if (slides.length > 0) {
        return slides.slice(0, 5)
    }

    const popularFallback = await fetchPopularAnime('week', 5)
    return popularFallback.map((item, index) => ({
        ...item,
        label: `#${index + 1} Populer Minggu Ini`,
        description: item.status || item.type || 'Rekomendasi populer Vidku',
        meta: [item.type, item.status].filter(Boolean),
        qualities: item.type ? [item.type] : []
    }))
}

async function scrapeHomepageAiring() {
    const $ = await fetchDocument('https://vidku.me/status/airing/')

    return $('a[href*="/anime/"]')
        .filter((_, element) => $(element).find('img').length > 0)
        .slice(0, 10)
        .map((_, element) => {
            const $element = $(element)
            const href = normalizeUrl($element.attr('href') || '')
            const imageElement = $element.find('img').first()
            const title = normalizeText(
                $element.find('.text-md.line-clamp-2').first().text() ||
                $element.find('.line-clamp-2').first().text() ||
                imageElement.attr('alt') ||
                $element.text()
            ).replace(/^airing\s+/i, '')

            const metaSpans = $element.find('span').map((__, span) => normalizeText($(span).text())).get().filter(Boolean)
            const type = metaSpans.find((text) => /^(tv|movie|ona|ova|special)$/i.test(text)) || ''
            const status = metaSpans.find((text) => /airing/i.test(text)) || 'Airing'
            const rating = metaSpans.find((text) => /^[0-9.]+$/.test(text)) || ''

            return {
                title,
                slug: extractSlug(href),
                poster: proxyImageUrl(
                    imageElement.attr('data-src') ||
                    imageElement.attr('src') ||
                    imageElement.attr('srcset')?.split(',')[0]?.trim().split(/\s+/)[0] ||
                    ''
                ),
                type,
                status,
                rating,
                episode_number: '',
                url: href
            }
        })
        .get()
        .filter((item) => item.slug && item.title)
}

function extractCardImage($element) {
    const imageElement = $element.find('img').first()
    const sourceSet = imageElement.attr('data-srcset') || imageElement.attr('srcset') || ''
    const firstSource = sourceSet
        .split(',')
        .map((entry) => entry.trim().split(/\s+/)[0])
        .find(Boolean)

    return normalizeUrl(
        imageElement.attr('data-src') ||
        imageElement.attr('data-lazy-src') ||
        imageElement.attr('data-original') ||
        firstSource ||
        imageElement.attr('src') ||
        ''
    )
}

function mapTrendingCards($, $cards) {
    return $cards.map((index, element) => {
        const $element = $(element)
        const href = normalizeUrl($element.attr('href') || '')
        const imageElement = $element.find('img').first()
        const title = normalizeText(
            $element.find('h3, h2, [class*="line-clamp"]').first().text() ||
            imageElement.attr('alt') ||
            $element.attr('title') ||
            ''
        )
        const metaText = normalizeText($element.find('.text-xs, .text-sm, span').last().text())
        const type = normalizeText($element.find('span').filter((_, span) => /^(TV|Movie|ONA|OVA|Special)$/i.test($(span).text().trim())).first().text())
        const status = /airing/i.test(metaText) ? 'Airing' : (/selesai|completed/i.test(metaText) ? 'Selesai' : '')

        return {
            title,
            slug: extractSlug(href),
            poster: proxyImageUrl(extractCardImage($element)),
            type,
            status,
            rating: '',
            episode_number: '',
            url: href,
            rank: index + 1
        }
    }).get().filter((item) => item.slug && item.title).slice(0, 10)
}

async function scrapeHomepageTrending() {
    try {
        const $ = await fetchDocument('https://vidku.me/')
        let items = mapTrendingCards($, $('.swiper.swiper-trending .swiper-slide a[href*="/anime/"]'))

        if (items.length === 0) {
            items = mapTrendingCards(
                $,
                $('.swiper-trending a[href*="/anime/"], [class*="trending"] a[href*="/anime/"], [class*="Trending"] a[href*="/anime/"]')
                    .filter((_, element) => $(element).find('img').length > 0)
            )
        }

        if (items.length > 0) return items
    } catch (error) {
        console.warn('Failed scraping vidku homepage trending, using popular fallback:', error.message)
    }

    const popularFallback = await fetchPopularAnime('week', 10)

    return popularFallback.map((item, index) => ({
        ...item,
        rank: index + 1
    }))
}

async function scrapeHomepageLatestEpisodes() {
    const $ = await fetchDocument('https://vidku.me/watch/')

    return $('a[href*="/watch/"]').filter((_, element) => $(element).find('img').length > 0).slice(0, 20).map((_, element) => {
        const $element = $(element)
        const href = normalizeUrl($element.attr('href') || '')
        const imageElement = $element.find('img').first()
        const title = normalizeText(
            $element.find('div.bottom-0 span').last().text() ||
            $element.find('span.text-base').first().text()
        )
        const episodeLabel = normalizeText($element.find('span.top-0').first().text())
        const episodeNumber = extractEpisodeNumber(episodeLabel)
        const fullTitle = episodeNumber ? `${title} Episode ${episodeNumber}` : title
        const rawText = normalizeText($element.text())

        return {
            title,
            full_title: fullTitle,
            slug: extractSlug(href),
            poster: proxyImageUrl(
                imageElement.attr('data-src') ||
                imageElement.attr('src') ||
                imageElement.attr('data-srcset')?.split(',')[0]?.trim().split(/\s+/)[0] ||
                ''
            ),
            type: '',
            episode_number: episodeNumber,
            duration: extractDuration(rawText),
            updated_at: extractUpdatedDate(rawText),
            url: href
        }
    }).get().filter((item) => item.slug && item.title)
}

function mapDetailEpisodeAnchor($, element) {
    const $element = $(element)
    const href = $element.attr('href')
    const title = $element.attr('title') || $element.find('.episode-list-item-title, .line-clamp-1, h3, h4').first().text() || $element.text()

    return {
        episode_number: extractEpisodeNumber(title),
        slug: extractSlug(href),
        title: decodeHtml(title || '').replace(/\s+/g, ' ').trim(),
        url: normalizeUrl(href)
    }
}

function mapDetailEpisodeItem(item) {
    const title = decodeHtml(item?.title?.rendered || '').replace(/\s+/g, ' ').trim()

    return {
        episode_number: extractEpisodeNumber(title),
        slug: item?.slug || extractSlug(item?.link),
        title,
        url: normalizeUrl(item?.link || '')
    }
}

async function fetchAnimeEpisodesFallback(animeItem, slug) {
    const title = decodeHtml(animeItem?.title?.rendered || '').replace(/\s+/g, ' ').trim()
    const searchTerms = [title, title.split(/\s+/).slice(0, 3).join(' '), slug.replace(/-/g, ' ')]
        .map((term) => term.trim())
        .filter(Boolean)

    for (const search of [...new Set(searchTerms)]) {
        try {
            const { items } = await fetchWpCollection('episode', {
                search,
                per_page: 100,
                orderby: 'date',
                order: 'asc'
            })
            const episodes = items
                .map(mapDetailEpisodeItem)
                .filter((episode) => episode.slug && episode.slug.startsWith(`${slug}-episode-`))

            if (episodes.length > 0) return episodes
        } catch (error) {
            console.warn(`[vidku] episode fallback failed for ${slug}:`, error.message)
        }
    }

    return []
}

async function scrapeAnimeDetail(slug) {
    try {
        const animeItem = await fetchWpSingle('anime', { slug })

        if (!animeItem) {
            throw new Error(`Anime not found: ${slug}`)
        }

        const $ = await fetchDocument(animeItem.link)
        const info = parseInfoList($)

        const overviewLabel = $('span').filter((_, element) => $(element).text().replace(/\s+/g, ' ').trim() === 'Overview:').first()
        const overviewText = overviewLabel.parent().find('span').last().text().replace(/\s+/g, ' ').trim()

        const genres = getEmbeddedTerms(animeItem, 'genre')
        const producers = getEmbeddedTerms(animeItem, 'producer')
        const studioTerms = getEmbeddedTerms(animeItem, 'studio')
        let episodeLists = $('#episode-grid .episode-item a[href*="/watch/"], #episode-grid a[href*="/watch/"], .eplist a[href*="/watch/"], ul.eps-list a[href*="/watch/"], div[id*="episode"] a[href*="/watch/"]')
            .map((_, element) => mapDetailEpisodeAnchor($, element))
            .get()
            .filter((episode) => episode.slug)

        if (episodeLists.length === 0) {
            episodeLists = await fetchAnimeEpisodesFallback(animeItem, slug)
        }

        if (episodeLists.length === 0) {
            console.warn(`[vidku] No episodes found for ${slug} at ${animeItem.link}`)
        }

        const anime = {
            title: decodeHtml(animeItem.title?.rendered || ''),
            japanese_title: info.Native || info.Name || '',
            slug,
            poster: getFeaturedImage(animeItem) || proxyImageUrl($('meta[property="og:image"]').attr('content')),
            rating: info.Score || '',
            score: info.Score || '',
            rate: info.Rate || '',
            type: getTermName(animeItem, 'type') || '',
            status: getTermName(animeItem, 'status') || '',
            episode_count: info.Episodes || String(episodeLists.length || ''),
            duration: info.Duration || '',
            premiered: info.Premiered || '',
            aired: info.Aired || '',
            release_date: info.Premiered || info.Aired || '',
            studio: studioTerms.map((studio) => studio.name).join(', ') || info.Studio || '',
            producers: producers.map((producer) => ({
                name: producer.name,
                slug: producer.slug
            })),
            producer: producers.map((producer) => producer.name).join(', ') || info.Producers || info.Producer || '',
            genres: genres.map((genre) => ({
                name: genre.name,
                slug: genre.slug
            })),
            synopsis: overviewText || stripHtml(animeItem.content?.rendered || ''),
            episode_lists: episodeLists
        }

        return {
            status: 'success',
            data: anime
        }
    } catch (error) {
        console.error('Error scraping vidku anime detail:', error.message)
        throw error
    }
}

function decodeEmbedPayload(encodedValue = '') {
    const encodedPayload = encodedValue.split(':').slice(1).join(':')
    if (!encodedPayload) return ''

    try {
        return Buffer.from(encodedPayload, 'base64').toString('utf8')
    } catch (error) {
        return ''
    }
}

async function scrapeEpisode(episodeSlug) {
    try {
        const episodeItem = await fetchWpSingle('episode', { slug: episodeSlug })
        const episodeUrl = episodeItem?.link || `https://vidku.me/watch/${episodeSlug}/`
        const html = await fetchHtml(episodeUrl)
        const $ = cheerio.load(html)

        const players = parsePlayerData(html)
        const primaryPlayer = players[0] || {}
        const animeLink = $('main a[href*="/anime/"]').first()
        const pageTitle = $('title').text().replace(/\s+-\s+Vidku$/i, '').trim()
        const downloadLinks = $('#popup1 a[href]').map((_, element) => {
            const href = $(element).attr('href')
            const quality = $(element).text().replace(/\s+/g, ' ').trim()

            if (!href || href === '#' || !quality) return null

            return {
                quality,
                url: normalizeUrl(href)
            }
        }).get().filter(Boolean)

        const extraServers = $('[data-embed-id]').map((_, element) => {
            const label = $(element).text().replace(/\s+/g, ' ').trim()
            const rawPayload = $(element).attr('data-embed-id') || ''
            const decodedPayload = decodeEmbedPayload(rawPayload) || rawPayload
            const decodedPlayers = parsePlayerData(decodedPayload)
            const decodedUrl = decodedPlayers[0]?.src || (/^https?:\/\//i.test(decodedPayload) ? decodedPayload : '')

            return {
                name: label || 'Default',
                url: normalizeUrl(decodedUrl)
            }
        }).get().filter((server) => server.url)

        const streamServers = [
            {
                name: primaryPlayer.default_quality || 'Default',
                url: normalizeUrl(primaryPlayer.src || '')
            },
            ...extraServers,
            ...[
                { name: 'low', url: normalizeUrl(primaryPlayer.low || '') },
                { name: 'medium', url: normalizeUrl(primaryPlayer.medium || '') },
                { name: 'high', url: normalizeUrl(primaryPlayer.high || '') }
            ]
        ].filter((server, index, servers) => {
            if (!server.url) return false
            return servers.findIndex((current) => current.url === server.url) === index
        })

        const title = decodeHtml(episodeItem?.title?.rendered || primaryPlayer.title || pageTitle)

        const episode = {
            title,
            slug: episodeSlug,
            anime_title: decodeHtml(animeLink.text() || extractAnimeTitleFromEpisodeTitle(title)),
            episode_number: extractEpisodeNumber(title),
            stream_url: normalizeUrl(primaryPlayer.src || streamServers[0]?.url || ''),
            download_links: downloadLinks,
            prev_episode: extractSlug(primaryPlayer.prev_episode_url || ''),
            next_episode: extractSlug(primaryPlayer.next_episode_url || ''),
            poster: proxyImageUrl(primaryPlayer.poster || '') || getFeaturedImage(episodeItem) || proxyImageUrl($('meta[property="og:image"]').attr('content')),
            description: $('meta[name="description"]').attr('content') || '',
            anime_slug: extractSlug(animeLink.attr('href')),
            stream_servers: streamServers
        }

        return {
            status: 'success',
            data: episode
        }
    } catch (error) {
        console.error('Error scraping vidku episode:', error.message)
        throw error
    }
}

module.exports = {
    scrapeHome,
    scrapeAnimeDetail,
    scrapeEpisode
}
