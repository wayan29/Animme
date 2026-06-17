const {
    BASE_URL,
    KIRANIME_API_BASE_URL,
    buildPagination,
    decodeHtml,
    extractSlug,
    fetchDocument,
    fetchJson,
    fetchWpCollection,
    getEmbeddedTerms,
    getTermName,
    mapWpAnimeItem,
    mapWpEpisodeItem,
    normalizeUrl,
    parseArchiveAnimeCards,
    parseArchivePagination,
    parseLatestEpisodeCards,
    proxyImageUrl,
    resolveTermIds
} = require('./helpers')

const SCHEDULE_DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
const SPECIAL_ARCHIVE_PATHS = {
    movie: '/anime-type/movie/',
    tv: '/anime-type/tv/',
    airing: '/status/airing/',
    az: '/az-list/',
    latest: '/watch/'
}

function buildArchiveUrl(path, page = 1, query = {}) {
    const url = new URL(path, BASE_URL)
    const cleanPath = url.pathname.replace(/\/+$/, '')

    url.pathname = page > 1
        ? `${cleanPath}/page/${page}/`
        : `${cleanPath}/`

    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value))
        }
    })

    return url.toString()
}

async function scrapeAnimeArchive(path, page = 1, query = {}) {
    const $ = await fetchDocument(buildArchiveUrl(path, page, query))

    return {
        animeData: parseArchiveAnimeCards($),
        pagination: parseArchivePagination($, page)
    }
}

function shouldUseAzArchive(filters = {}) {
    const order = String(filters.order || '').toLowerCase()
    return Boolean(filters.letter) || (
        ['az', 'a-z', 'title_asc'].includes(order) &&
        !filters.title &&
        !filters.status &&
        !filters.type &&
        !(Array.isArray(filters.genre) && filters.genre.length > 0)
    )
}

async function scrapeAnimeList(page = 1) {
    try {
        const $ = await fetchDocument(buildArchiveUrl(SPECIAL_ARCHIVE_PATHS.latest, page))

        return {
            status: 'success',
            data: {
                animeData: parseLatestEpisodeCards($),
                paginationData: parseArchivePagination($, page)
            }
        }
    } catch (error) {
        console.error('Error scraping vidku anime list:', error.message)
        throw error
    }
}

async function scrapeSchedule() {
    try {
        const dayEntries = await Promise.allSettled(
            SCHEDULE_DAYS.map(async (day) => {
                const items = await fetchJson(`${KIRANIME_API_BASE_URL}/schedule/day`, {
                    params: { day }
                })

                return {
                    day,
                    items: Array.isArray(items) ? items : []
                }
            })
        )

        const schedule = dayEntries.reduce((result, entry) => {
            if (entry.status !== 'fulfilled' || entry.value.items.length === 0) {
                return result
            }

            result[entry.value.day] = entry.value.items.map((item) => ({
                title: decodeHtml(item.title || ''),
                slug: extractSlug(item.url),
                poster: proxyImageUrl(item.thumbnail || ''),
                type: item.type || '',
                score: item.score || '',
                episode_number: item.episode_number || '',
                scheduled_time: item.scheduled_time || '',
                episode_date: item.episode_date || '',
                url: normalizeUrl(item.url),
                episode_url: normalizeUrl(item.episode_url)
            }))

            return result
        }, {})

        return {
            status: 'success',
            data: schedule
        }
    } catch (error) {
        console.error('Error scraping vidku schedule:', error.message)
        throw error
    }
}

function applySortFilters(params, order) {
    const normalizedOrder = String(order || '').toLowerCase()

    switch (normalizedOrder) {
        case 'title_asc':
        case 'az':
        case 'a-z':
            params.orderby = 'title'
            params.order = 'asc'
            break
        case 'title_desc':
        case 'za':
        case 'z-a':
            params.orderby = 'title'
            params.order = 'desc'
            break
        case 'oldest':
            params.orderby = 'date'
            params.order = 'asc'
            break
        case 'updated':
            params.orderby = 'modified'
            params.order = 'desc'
            break
        default:
            params.orderby = 'date'
            params.order = 'desc'
            break
    }
}

async function scrapeAllAnime(filters = {}, page = 1) {
    try {
        const normalizedType = String(filters.type || '').toLowerCase()
        const normalizedStatus = String(filters.status || '').toLowerCase()

        if (normalizedType === 'movie') {
            const archive = await scrapeAnimeArchive(SPECIAL_ARCHIVE_PATHS.movie, page)

            return {
                status: 'success',
                data: {
                    animeData: archive.animeData,
                    pagination: archive.pagination,
                    total_results: archive.pagination.total_items || archive.animeData.length
                }
            }
        }

        if (normalizedType === 'tv') {
            const archive = await scrapeAnimeArchive(SPECIAL_ARCHIVE_PATHS.tv, page)

            return {
                status: 'success',
                data: {
                    animeData: archive.animeData,
                    pagination: archive.pagination,
                    total_results: archive.pagination.total_items || archive.animeData.length
                }
            }
        }

        if (normalizedStatus === '3' || normalizedStatus === 'airing') {
            const archive = await scrapeAnimeArchive(SPECIAL_ARCHIVE_PATHS.airing, page)

            return {
                status: 'success',
                data: {
                    animeData: archive.animeData,
                    pagination: archive.pagination,
                    total_results: archive.pagination.total_items || archive.animeData.length
                }
            }
        }

        if (shouldUseAzArchive(filters)) {
            const archive = await scrapeAnimeArchive(SPECIAL_ARCHIVE_PATHS.az, page, {
                letter: filters.letter || ''
            })

            return {
                status: 'success',
                data: {
                    animeData: archive.animeData,
                    pagination: archive.pagination,
                    total_results: archive.pagination.total_items || archive.animeData.length
                }
            }
        }

        const params = {
            per_page: 24,
            page,
            _embed: 1
        }

        applySortFilters(params, filters.order)

        if (filters.title) {
            params.search = filters.title
        }

        const [genreIds, statusIds, typeIds] = await Promise.all([
            filters.genre ? resolveTermIds('genre', filters.genre) : Promise.resolve([]),
            filters.status ? resolveTermIds('anime_status', filters.status) : Promise.resolve([]),
            filters.type ? resolveTermIds('anime_type', filters.type) : Promise.resolve([])
        ])

        if (genreIds.length > 0) params.genre = genreIds.join(',')
        if (statusIds.length > 0) params.anime_status = statusIds.join(',')
        if (typeIds.length > 0) params.anime_type = typeIds.join(',')

        const { items, headers } = await fetchWpCollection('anime', params)

        const results = items.map((item) => ({
            ...mapWpAnimeItem(item),
            genres: getEmbeddedTerms(item, 'genre').map((genre) => ({
                name: genre.name,
                slug: genre.slug
            })),
            status: getTermName(item, 'status') || '',
            type: getTermName(item, 'type') || ''
        }))

        return {
            status: 'success',
            data: {
                animeData: results,
                pagination: buildPagination(headers, page),
                total_results: Number(headers['x-wp-total'] || results.length)
            }
        }
    } catch (error) {
        console.error('Error scraping vidku all anime:', error.message)
        throw error
    }
}

module.exports = {
    scrapeAnimeList,
    scrapeSchedule,
    scrapeAllAnime
}
