const axios = require('axios')
const cheerio = require('cheerio')

const {
    BASE_URL,
    KIRANIME_API_BASE_URL,
    USER_AGENT,
    buildStaticPagination,
    decodeHtml,
    extractSlug,
    fetchHtml,
    fetchJson,
    normalizeText,
    normalizeUrl,
    proxyImageUrl,
    resolveTermIds
} = require('./helpers')

const ADVANCED_SEARCH_URL = `${BASE_URL}/search/?asp=1&orderby=popular&order=desc`
const ADVANCED_ORDERBY_OPTIONS = [
    { value: 'popular', label: 'Terpopuler' },
    { value: 'favorite', label: 'Paling Difavoritkan' },
    { value: 'updated', label: 'Terbaru Diperbarui' },
    { value: 'date', label: 'Tanggal Rilis' },
    { value: 'title', label: 'Judul A-Z' }
]
const ADVANCED_ORDER_OPTIONS = [
    { value: 'desc', label: 'Menurun' },
    { value: 'asc', label: 'Menaik' }
]
const ADVANCED_TERM_RESOURCES = {
    genre: 'genre',
    status: 'anime_status',
    producer: 'producer',
    studio: 'studio',
    type: 'anime_type',
    season: 'season'
}

function parseAdvancedSearchConfig(html = '') {
    const configMatch = html.match(/var\s+krSconf\s*=\s*"([^"]+)"/)

    if (!configMatch?.[1]) {
        throw new Error('Advanced search config not found')
    }

    const decodedConfig = Buffer.from(configMatch[1], 'base64').toString('utf8')
    return JSON.parse(decodedConfig)
}

function mapConfigTerms(items = []) {
    return (Array.isArray(items) ? items : [])
        .map((item) => {
            const name = normalizeText(item?.name || '')
            const slug = String(item?.slug || '').trim()
            const id = Number(item?.term_id || item?.id || 0)

            if (!name || !slug) {
                return null
            }

            return {
                id,
                name,
                slug
            }
        })
        .filter(Boolean)
}

function mapSeasonOptions(items = []) {
    return (Array.isArray(items) ? items : [])
        .map((item) => {
            const name = normalizeText(item?.name || '')
            const slug = String(item?.slug || '').trim()
            const id = Number(item?.id || 0)

            if (!name || !slug) {
                return null
            }

            return {
                id,
                name,
                slug
            }
        })
        .filter(Boolean)
}

function normalizeAdvancedSelection(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map((entry) => String(entry))
    }

    if (!value) {
        return []
    }

    return [String(value)]
}

function applyAdvancedSort(params, orderby, order) {
    const normalizedOrderby = String(orderby || 'popular').toLowerCase()
    const normalizedOrder = String(order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

    params.order = normalizedOrder

    switch (normalizedOrderby) {
        case 'updated':
            params.orderby = 'meta_value_num'
            params.meta_key = 'kiranime_anime_updated'
            break
        case 'favorite':
            params.orderby = 'meta_value_num'
            params.meta_key = 'bookmark_count'
            break
        case 'date':
            params.orderby = 'date'
            break
        case 'title':
            params.orderby = 'title'
            break
        case 'popular':
        default:
            params.orderby = 'meta_value_num'
            params.meta_key = 'total_kiranime_views'
            break
    }
}

async function resolveAdvancedTermIds(field, value) {
    const resource = ADVANCED_TERM_RESOURCES[field]
    const selectedValues = normalizeAdvancedSelection(value)

    if (!resource || selectedValues.length === 0) {
        return []
    }

    try {
        return await resolveTermIds(resource, selectedValues)
    } catch (error) {
        console.warn(`Failed to resolve Vidku advanced search term "${field}": ${error.message}`)
        return []
    }
}

function buildAdvancedSearchPayload(filters = {}, page = 1) {
    const keyword = normalizeText(filters.title || filters.keyword || '')
    const payload = {
        keyword,
        query: keyword,
        single: {
            paged: page
        },
        tax: []
    }

    applyAdvancedSort(payload.single, filters.orderby, filters.order)

    const statusSlug = normalizeAdvancedSelection(filters.status)[0]
    const typeSlug = normalizeAdvancedSelection(filters.type)[0]
    const seasonSlug = normalizeAdvancedSelection(filters.season)[0]

    if (statusSlug) payload.single.status = statusSlug
    if (typeSlug) payload.single.type = typeSlug
    if (seasonSlug) payload.single.season = seasonSlug

    return payload
}

function mapAdvancedTaxonomies(items = []) {
    return (Array.isArray(items) ? items : []).map((item) => ({
        name: normalizeText(item?.name || ''),
        slug: String(item?.slug || '').trim()
    })).filter((item) => item.name && item.slug)
}

function mapAdvancedSearchItem(item = {}) {
    const post = item.post || {}
    const meta = item.meta || {}
    const taxonomies = item.taxonomies || {}
    const genres = mapAdvancedTaxonomies(taxonomies.genre)
    const statuses = mapAdvancedTaxonomies(taxonomies.status)
    const types = mapAdvancedTaxonomies(taxonomies.type)
    const producers = mapAdvancedTaxonomies(taxonomies.producer)
    const studios = mapAdvancedTaxonomies(taxonomies.studio)

    return {
        title: decodeHtml(post.post_title || ''),
        slug: post.post_name || extractSlug(item.url || ''),
        poster: proxyImageUrl(item.image_url || ''),
        type: types[0]?.name || '',
        status: statuses[0]?.name || '',
        rating: normalizeText(meta.score || ''),
        episode_number: normalizeText(item?.episodes?.meta?.number || ''),
        genres,
        producer: producers[0]?.name || '',
        studio: studios[0]?.name || '',
        season: normalizeText(meta.premiered || ''),
        url: normalizeUrl(item.url || '')
    }
}

async function scrapeSearch(keyword) {
    try {
        const response = await fetchJson(`${KIRANIME_API_BASE_URL}/anime/search`, {
            params: { query: keyword }
        })

        const $ = cheerio.load(response?.result || '')
        const results = $('a[href*="/anime/"]').map((_, element) => {
            const $element = $(element)
            const href = $element.attr('href')
            const slug = extractSlug(href)
            const title = $element.find('h3').first().text().replace(/\s+/g, ' ').trim()
            const metadata = $element.find('span').map((__, span) => $(span).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean)
            const img = $element.find('img').first()
            const poster = img.attr('data-src') || img.attr('src') || ''

            if (!slug || !title) return null

            return {
                title: decodeHtml(title),
                slug,
                poster: proxyImageUrl(poster),
                type: metadata[1] || '',
                status: '',
                rating: '',
                genres: [],
                url: normalizeUrl(href)
            }
        }).get().filter(Boolean)

        return {
            status: 'success',
            data: results
        }
    } catch (error) {
        console.error('Error scraping vidku search:', error.message)
        throw error
    }
}

async function scrapeAdvancedSearchConfig() {
    try {
        const html = await fetchHtml(ADVANCED_SEARCH_URL)
        const config = parseAdvancedSearchConfig(html)

        return {
            status: 'success',
            data: {
                defaults: {
                    keyword: normalizeText(config.keyword || ''),
                    orderby: String(config.orderby || 'popular').toLowerCase(),
                    order: String(config.order || 'desc').toLowerCase(),
                    page: Number(config.page || 1)
                },
                options: {
                    orderby: ADVANCED_ORDERBY_OPTIONS,
                    order: ADVANCED_ORDER_OPTIONS,
                    genre: mapConfigTerms(config?.terms?.Genre),
                    status: mapConfigTerms(config?.terms?.Status),
                    producer: mapConfigTerms(config?.terms?.Producer),
                    studio: mapConfigTerms(config?.terms?.Studio),
                    type: mapConfigTerms(config?.terms?.Type),
                    season: mapSeasonOptions(config?.season)
                }
            }
        }
    } catch (error) {
        console.error('Error scraping vidku advanced search config:', error.message)
        throw error
    }
}

async function scrapeAdvancedSearch(filters = {}, page = 1) {
    try {
        const payload = buildAdvancedSearchPayload(filters, page)

        const [
            genreIds,
            producerIds,
            studioIds
        ] = await Promise.all([
            resolveAdvancedTermIds('genre', filters.genre),
            resolveAdvancedTermIds('producer', filters.producer),
            resolveAdvancedTermIds('studio', filters.studio)
        ])

        if (genreIds.length > 0) {
            payload.tax.push({ taxonomy: 'genre', terms: genreIds })
        }
        if (producerIds.length > 0) {
            payload.tax.push({ taxonomy: 'producer', terms: producerIds })
        }
        if (studioIds.length > 0) {
            payload.tax.push({ taxonomy: 'studio', terms: studioIds })
        }

        const response = await axios.post(`${KIRANIME_API_BASE_URL}/anime/advancedsearch`, payload, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                Accept: 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                Referer: ADVANCED_SEARCH_URL
            },
            timeout: 30000,
            validateStatus: () => true
        })

        if (response.status >= 400) {
            throw new Error(`Request failed with status code ${response.status}`)
        }

        const responseData = response.data || {}
        const items = Array.isArray(responseData.data) ? responseData.data : []
        const results = items.map(mapAdvancedSearchItem).filter((item) => item.slug && item.title)
        const totalPages = Number(responseData.pages || 1)
        const totalItems = Number(responseData.total || results.length)
        const keyword = normalizeText(filters.title || filters.keyword || '')

        return {
            status: 'success',
            data: {
                animeData: results,
                pagination: buildStaticPagination(page, totalPages, totalItems),
                total_results: totalItems,
                applied_filters: {
                    title: keyword,
                    orderby: String(filters.orderby || 'popular').toLowerCase(),
                    order: String(filters.order || 'desc').toLowerCase(),
                    status: normalizeAdvancedSelection(filters.status),
                    type: normalizeAdvancedSelection(filters.type),
                    genre: normalizeAdvancedSelection(filters.genre),
                    producer: normalizeAdvancedSelection(filters.producer),
                    studio: normalizeAdvancedSelection(filters.studio),
                    season: normalizeAdvancedSelection(filters.season)
                }
            }
        }
    } catch (error) {
        console.error('Error scraping vidku advanced search:', error.message)
        throw error
    }
}

module.exports = {
    scrapeSearch,
    scrapeAdvancedSearchConfig,
    scrapeAdvancedSearch
}
