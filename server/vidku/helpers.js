const axios = require('axios')
const cheerio = require('cheerio')
const crypto = require('crypto')

const BASE_URL = 'https://vidku.me'
const API_BASE_URL = `${BASE_URL}/wp-json`
const KIRANIME_API_BASE_URL = `${API_BASE_URL}/kiranime/v1`
const WP_API_BASE_URL = `${API_BASE_URL}/wp/v2`
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'

const imageUrlMap = new Map()

function normalizeUrl(url = '') {
    if (!url) return ''
    if (url.startsWith('//')) return `https:${url}`
    if (/^https?:\/\//i.test(url)) return url
    if (url.startsWith('/')) return `${BASE_URL}${url}`
    return url
}

function getImageHash(url) {
    return crypto.createHash('md5').update(url).digest('hex')
}

function proxyImageUrl(url) {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl || !normalizedUrl.startsWith('http')) return normalizedUrl

    const hash = getImageHash(normalizedUrl)
    imageUrlMap.set(hash, normalizedUrl)

    return `/img/${hash}`
}

function getImageUrlMap() {
    return imageUrlMap
}

function extractSlug(url) {
    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl) return ''

    const match = normalizedUrl.match(/\/(?:anime|watch)\/([^/?#]+)/)
    return match ? match[1] : ''
}

function stripHtml(html = '') {
    if (!html) return ''

    const $ = cheerio.load(`<div id="root">${html}</div>`)
    return $('#root').text().replace(/\s+/g, ' ').trim()
}

function decodeHtml(text = '') {
    if (!text) return ''

    return cheerio.load(`<div>${text}</div>`)('div').text().trim()
}

function normalizeText(text = '') {
    return decodeHtml(text).replace(/\s+/g, ' ').trim()
}

function slugify(value = '') {
    return decodeHtml(value)
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function getRequestOptions(options = {}) {
    return {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            Referer: BASE_URL,
            ...(options.headers || {})
        },
        timeout: options.timeout || 30000,
        validateStatus: () => true,
        params: options.params || undefined
    }
}

async function fetchHtml(url, options = {}) {
    const response = await axios.get(normalizeUrl(url), getRequestOptions(options))

    if (response.status >= 400) {
        throw new Error(`Request failed with status code ${response.status}`)
    }

    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
}

async function fetchJson(url, options = {}) {
    const response = await axios.get(normalizeUrl(url), {
        ...getRequestOptions(options),
        headers: {
            Accept: 'application/json, text/plain, */*',
            ...getRequestOptions(options).headers
        }
    })

    if (response.status >= 400) {
        throw new Error(`Request failed with status code ${response.status}`)
    }

    return response.data
}

async function fetchDocument(url, options = {}) {
    const html = await fetchHtml(url, options)
    return cheerio.load(html)
}

async function fetchWpCollection(resource, params = {}) {
    const response = await axios.get(`${WP_API_BASE_URL}/${resource}`, getRequestOptions({ params }))

    if (response.status >= 400) {
        throw new Error(`Request failed with status code ${response.status}`)
    }

    return {
        items: Array.isArray(response.data) ? response.data : [],
        headers: response.headers || {}
    }
}

async function fetchWpSingle(resource, params = {}) {
    const { items } = await fetchWpCollection(resource, {
        ...params,
        per_page: 1,
        _embed: 1
    })

    return items[0] || null
}

function getFeaturedImage(item) {
    return proxyImageUrl(item?._embedded?.['wp:featuredmedia']?.[0]?.source_url || '')
}

function getEmbeddedTerms(item, taxonomy) {
    return (item?._embedded?.['wp:term'] || [])
        .flat()
        .filter((term) => term.taxonomy === taxonomy)
}

function getTermName(item, taxonomy) {
    return getEmbeddedTerms(item, taxonomy)[0]?.name || ''
}

function parseInfoList($) {
    const info = {}

    $('li.ani-info').each((_, element) => {
        const $element = $(element)
        const key = $element.find('span').first().text().replace(':', '').replace(/\s+/g, ' ').trim()

        if (!key) return

        let value = ''

        if (['Genre', 'Producers', 'Producer', 'Studio'].includes(key)) {
            value = $element.find('a').map((__, anchor) => $(anchor).text().replace(/\s+/g, ' ').trim()).get().join(', ')
        } else {
            value = $element.find('span').slice(1).last().text().replace(/\s+/g, ' ').trim()
        }

        info[key] = value
    })

    return info
}

function extractEpisodeNumber(title = '') {
    const match = decodeHtml(title).match(/Episode\s+(\d+(?:\.\d+)?)/i)
    return match ? match[1] : ''
}

function extractAnimeTitleFromEpisodeTitle(title = '') {
    const cleanedTitle = decodeHtml(title).replace(/\s+/g, ' ').trim()
    const match = cleanedTitle.match(/^(.*?)\s+Episode\s+\d+(?:\.\d+)?/i)

    return match ? match[1].trim() : cleanedTitle
}

function extractDuration(text = '') {
    const cleaned = normalizeText(text)
    const match = cleaned.match(/\b\d{1,3}\s*(?:m|min|mins|minute|minutes)\b/i)
    return match ? match[0].replace(/\s+/g, '').toUpperCase().replace('MINUTES', 'M').replace('MINUTE', 'M').replace('MINS', 'M').replace('MIN', 'M') : ''
}

function extractUpdatedDate(text = '') {
    const cleaned = normalizeText(text)
    const match = cleaned.match(/Di Update:\s*([A-Za-z0-9 ]+)/i)
    return match ? normalizeText(match[1]) : ''
}

function buildPagination(headers = {}, currentPage = 1) {
    const totalPages = Number(headers['x-wp-totalpages'] || currentPage || 1)
    const totalItems = Number(headers['x-wp-total'] || 0)

    return {
        current_page: currentPage,
        has_next_page: currentPage < totalPages,
        has_previous_page: currentPage > 1,
        next_page: currentPage < totalPages ? currentPage + 1 : null,
        previous_page: currentPage > 1 ? currentPage - 1 : null,
        last_page: totalPages,
        total_pages: totalPages,
        total_items: totalItems
    }
}

function extractPageNumberFromUrl(url = '') {
    const normalizedUrl = normalizeUrl(url)

    if (!normalizedUrl) return null

    const pageMatch = normalizedUrl.match(/\/page\/(\d+)\/?/i)
    if (pageMatch) {
        return Number(pageMatch[1])
    }

    try {
        const parsedUrl = new URL(normalizedUrl)
        const page = parsedUrl.searchParams.get('page')
        return page && /^\d+$/.test(page) ? Number(page) : null
    } catch (error) {
        return null
    }
}

function buildStaticPagination(currentPage = 1, lastPage = currentPage, totalItems = 0) {
    const safeCurrentPage = Math.max(1, Number(currentPage || 1))
    const safeLastPage = Math.max(safeCurrentPage, Number(lastPage || safeCurrentPage))

    return {
        current_page: safeCurrentPage,
        has_next_page: safeCurrentPage < safeLastPage,
        has_previous_page: safeCurrentPage > 1,
        next_page: safeCurrentPage < safeLastPage ? safeCurrentPage + 1 : null,
        previous_page: safeCurrentPage > 1 ? safeCurrentPage - 1 : null,
        last_page: safeLastPage,
        total_pages: safeLastPage,
        total_items: Number(totalItems || 0)
    }
}

function parseArchivePagination($, currentPage = 1) {
    const pageNumbers = new Set([Number(currentPage || 1)])

    $('ul.page-numbers .page-numbers').each((_, element) => {
        const value = normalizeText($(element).text()).replace(/,/g, '')
        if (/^\d+$/.test(value)) {
            pageNumbers.add(Number(value))
        }
    })

    const nextPage = extractPageNumberFromUrl($('link[rel="next"]').attr('href') || '') ||
        extractPageNumberFromUrl($('a.page-numbers.next').attr('href') || '')
    const previousPage = extractPageNumberFromUrl($('link[rel="prev"]').attr('href') || '') ||
        extractPageNumberFromUrl($('a.page-numbers.prev').attr('href') || '')

    if (nextPage) {
        pageNumbers.add(nextPage)
    }

    if (previousPage) {
        pageNumbers.add(previousPage)
    }

    return buildStaticPagination(
        currentPage,
        Math.max(...pageNumbers),
        0
    )
}

function getBestImageSource($element) {
    const sourceSet = $element.attr('data-srcset') || $element.attr('srcset') || ''
    const firstSource = sourceSet
        .split(',')
        .map((entry) => entry.trim().split(/\s+/)[0])
        .find(Boolean)

    return normalizeUrl(
        $element.attr('data-src') ||
        $element.attr('src') ||
        firstSource ||
        ''
    )
}

function parseCardMetaText($, $element, matcher) {
    const metaTexts = $element.find('span').map((_, span) => normalizeText($(span).text())).get()
    return metaTexts.find((text) => matcher(text)) || ''
}

function parseQualityBadge($, $element) {
    return parseCardMetaText($, $element, (text) => {
        if (!text) return false
        if (/^(movie|tv|ova|ona|special)$/i.test(text)) return false
        if (/^(ep\.?\s*\d+|episode\s+\d+)/i.test(text)) return false
        if (/^\d+(?:\.\d+)?$/.test(text)) return false
        return /(cam|hd|fhd|4k|hevc|sub)/i.test(text) || text.includes('/')
    })
}

function parseArchiveAnimeCards($, rootSelector = 'section.grid.grid-anime-auto, section.w-full.main-width, div.grid.grid-anime-auto') {
    const $roots = $(rootSelector)
    const $root = $roots.length > 1 ? $($roots.get($roots.length - 1)) : $roots.first()
    const $cards = ($root.length ? $root : $('body'))
        .find('a[href*="/anime/"]')
        .filter((_, element) => $(element).find('img').length > 0)

    const seenSlugs = new Set()

    return $cards.map((_, element) => {
        const $element = $(element)
        const href = normalizeUrl($element.attr('href') || '')
        const slug = extractSlug(href)
        const title = normalizeText(
            $element.find('.text-md.line-clamp-2').first().text() ||
            $element.find('.line-clamp-2').first().text() ||
            $element.find('h3').first().text()
        )

        if (!slug || !title || seenSlugs.has(slug)) {
            return null
        }

        seenSlugs.add(slug)

        const poster = proxyImageUrl(getBestImageSource($element.find('img').first()))
        const status = normalizeText($element.find('.status_show').first().text())
        const rating = normalizeText($element.find('span.bg-accent-3').first().text())
        const type = normalizeText($element.find('span.bg-gray-800').first().text())
        const qualityBadge = parseQualityBadge($, $element)
        const episodeText = parseCardMetaText($, $element, (text) => /^ep\.?\s*\d+/i.test(text) || /^episode\s+\d+/i.test(text))
        const episodeNumberMatch = episodeText.match(/(\d+(?:\.\d+)?)/)

        return {
            title,
            slug,
            poster,
            quality_badge: qualityBadge,
            type,
            status,
            rating,
            episode_number: episodeNumberMatch ? episodeNumberMatch[1] : '',
            genres: [],
            url: href
        }
    }).get().filter(Boolean)
}

function parseLatestEpisodeCards($, rootSelector = 'section.grid.grid-episode-auto, div.grid.grid-cols-1.md\\:grid-cols-4.lg\\:grid-cols-4') {
    const $root = $(rootSelector).first()
    const $cards = ($root.length ? $root : $('body'))
        .find('a[href*="/watch/"]')
        .filter((_, element) => $(element).find('img').length > 0)

    const seenSlugs = new Set()

    return $cards.map((_, element) => {
        const $element = $(element)
        const href = normalizeUrl($element.attr('href') || '')
        const slug = extractSlug(href)
        const title = normalizeText(
            $element.find('div.bottom-0 span').last().text() ||
            $element.find('span.text-base').first().text() ||
            $element.find('h4').first().text()
        )
        const episodeLabel = normalizeText(
            $element.find('span.top-0').first().text() ||
            $element.find('span').first().text()
        )
        const episodeNumberMatch = episodeLabel.match(/(\d+(?:\.\d+)?)/)

        if (!slug || !title || seenSlugs.has(slug)) {
            return null
        }

        seenSlugs.add(slug)

        return {
            title,
            full_title: episodeNumberMatch ? `${title} Episode ${episodeNumberMatch[1]}` : title,
            slug,
            poster: proxyImageUrl(getBestImageSource($element.find('img').first())),
            type: '',
            episode_number: episodeNumberMatch ? episodeNumberMatch[1] : '',
            url: href
        }
    }).get().filter(Boolean)
}

function mapWpAnimeItem(item, extra = {}) {
    return {
        title: decodeHtml(item?.title?.rendered || extra.title || ''),
        slug: item?.slug || extractSlug(item?.link || extra.url || ''),
        poster: getFeaturedImage(item) || proxyImageUrl(extra.poster || ''),
        type: extra.type || getTermName(item, 'type') || '',
        status: extra.status || getTermName(item, 'status') || '',
        rating: extra.rating || '',
        episode_number: extra.episode_number || '',
        url: normalizeUrl(item?.link || extra.url || '')
    }
}

function mapWpEpisodeItem(item, extra = {}) {
    const fullTitle = decodeHtml(item?.title?.rendered || extra.full_title || '')

    return {
        title: extra.title || extractAnimeTitleFromEpisodeTitle(fullTitle),
        full_title: fullTitle,
        slug: item?.slug || extractSlug(item?.link || extra.url || ''),
        poster: getFeaturedImage(item) || proxyImageUrl(extra.poster || ''),
        type: extra.type || getTermName(item, 'episode_type') || '',
        episode_number: extra.episode_number || extractEpisodeNumber(fullTitle),
        url: normalizeUrl(item?.link || extra.url || '')
    }
}

function parsePlayerData(html = '') {
    return [...html.matchAll(/__oplayers__\.push\((\{.*?\})\);/gs)]
        .map((match) => {
            try {
                return JSON.parse(match[1])
            } catch (error) {
                return null
            }
        })
        .filter(Boolean)
}

async function resolveTermIds(resource, values) {
    const requestedValues = (Array.isArray(values) ? values : [values]).filter(Boolean)
    const resolvedIds = []

    for (const value of requestedValues) {
        if (typeof value === 'number' || /^\d+$/.test(String(value))) {
            resolvedIds.push(Number(value))
            continue
        }

        const slug = slugify(String(value))

        const slugMatch = await fetchJson(`${WP_API_BASE_URL}/${resource}`, {
            params: {
                slug,
                per_page: 100
            }
        })

        if (Array.isArray(slugMatch) && slugMatch.length > 0) {
            resolvedIds.push(slugMatch[0].id)
            continue
        }

        const searchMatch = await fetchJson(`${WP_API_BASE_URL}/${resource}`, {
            params: {
                search: String(value),
                per_page: 100
            }
        })

        if (Array.isArray(searchMatch) && searchMatch.length > 0) {
            resolvedIds.push(searchMatch[0].id)
        }
    }

    return [...new Set(resolvedIds)]
}

module.exports = {
    BASE_URL,
    API_BASE_URL,
    KIRANIME_API_BASE_URL,
    WP_API_BASE_URL,
    USER_AGENT,
    normalizeUrl,
    getImageHash,
    proxyImageUrl,
    getImageUrlMap,
    extractSlug,
    stripHtml,
    decodeHtml,
    normalizeText,
    fetchHtml,
    fetchJson,
    fetchDocument,
    fetchWpCollection,
    fetchWpSingle,
    getFeaturedImage,
    getEmbeddedTerms,
    getTermName,
    parseInfoList,
    extractEpisodeNumber,
    extractAnimeTitleFromEpisodeTitle,
    buildPagination,
    buildStaticPagination,
    extractPageNumberFromUrl,
    parseArchivePagination,
    parseArchiveAnimeCards,
    parseLatestEpisodeCards,
    mapWpAnimeItem,
    mapWpEpisodeItem,
    extractDuration,
    extractUpdatedDate,
    parsePlayerData,
    resolveTermIds
}
