const API_BASE = '/api/v10/vidku';
const GENRE_OPTIONS = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi',
    'Fantasy', 'Harem', 'Historical', 'Isekai', 'Magic',
    'Martial Arts', 'Mecha', 'Military', 'Music', 'Mystery',
    'Psychological', 'Romance', 'School', 'Sci-Fi', 'Seinen',
    'Shounen', 'Slice of Life', 'Sports', 'Super Power', 'Supernatural'
];

const PAGE_KIND = document.body.dataset.pageKind || 'all-anime';
const currentPath = window.location.pathname;
const currentQuery = new URLSearchParams(window.location.search);
const IS_ADVANCED_SEARCH = currentPath === '/v10/advanced-search';

let currentPage = Math.max(1, Number(currentQuery.get('page') || 1));
let totalPages = 1;
let currentPreset = 'all';
let advancedSearchConfig = null;

document.addEventListener('DOMContentLoaded', async () => {
    initServerSelect();
    initSidebarToggle();
    initSearchUi();
    initNavState();

    if (PAGE_KIND === 'all-anime') {
        await initFilterUi();
        applyPresetFromPath();
        syncFiltersFromQuery();
    }

    if (PAGE_KIND === 'search') {
        initHeroSearch();
    }

    loadPageData();
});

function changeServer(server) {
    localStorage.setItem('selectedServer', server);

    const targetPaths = {
        v1: '/v1/home',
        v2: '/v2/home',
        v3: '/v3/home',
        v4: '/v4/home',
        v5: '/v5/home',
        v6: '/v6/home',
        v7: '/v7/home',
        v8: '/v8/home',
        v9: '/v9/home',
        v10: '/v10/'
    };

    window.location.href = targetPaths[server] || '/v1/home';
}

function initServerSelect() {
    const serverSelect = document.getElementById('serverSelect');
    if (!serverSelect) return;

    serverSelect.value = 'v10';
    serverSelect.addEventListener('change', (event) => changeServer(event.target.value));
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            document.body.classList.add('sidebar-open');
            sidebar.classList.add('active');
            if (backdrop) backdrop.classList.add('active');
        });
    }

    if (menuCloseBtn && sidebar) {
        menuCloseBtn.addEventListener('click', closeSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    document.body.classList.remove('sidebar-open');
    if (sidebar) sidebar.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
}

function initSearchUi() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchContainer = document.querySelector('.search-container');
    const initialQuery = currentQuery.get('q') || '';

    if (searchInput) {
        searchInput.value = initialQuery;
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                executeSearch();
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', executeSearch);
    }

    if (searchIconBtn && searchContainer) {
        searchIconBtn.addEventListener('click', () => searchContainer.classList.add('active'));
    }

    if (searchCloseBtn && searchContainer) {
        searchCloseBtn.addEventListener('click', () => searchContainer.classList.remove('active'));
    }
}

function initHeroSearch() {
    const heroSearchForm = document.getElementById('heroSearchForm');
    const heroSearchInput = document.getElementById('heroSearchInput');
    const keyword = currentQuery.get('q') || '';

    if (heroSearchInput) {
        heroSearchInput.value = keyword;
    }

    if (heroSearchForm) {
        heroSearchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const value = heroSearchInput ? heroSearchInput.value.trim() : '';
            redirectToSearch(value);
        });
    }
}

function initNavState() {
    const navLinks = document.querySelectorAll('.sidebar .nav-link');

    navLinks.forEach((link) => {
        const href = new URL(link.href, window.location.origin);
        const isActive = href.pathname === currentPath;
        link.classList.toggle('active', isActive);
    });

    const shortcutLinks = document.querySelectorAll('.shortcut-chip');
    shortcutLinks.forEach((link) => {
        const href = new URL(link.href, window.location.origin);
        link.classList.toggle('active', href.pathname === currentPath);
    });
}

async function initFilterUi() {
    renderGenreOptions();

    const genreToggleBtn = document.getElementById('genreToggleBtn');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const mobileFilterToggle = document.getElementById('mobileFilterToggle');
    const animeFilters = document.getElementById('animeFilters');

    if (genreToggleBtn) {
        genreToggleBtn.addEventListener('click', toggleGenrePanel);
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetFilters);
    }

    if (mobileFilterToggle && animeFilters) {
        mobileFilterToggle.addEventListener('click', () => {
            const nextOpen = !animeFilters.classList.contains('mobile-open');
            animeFilters.classList.toggle('mobile-open', nextOpen);
            mobileFilterToggle.classList.toggle('active', nextOpen);
            mobileFilterToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        });
    }

    if (IS_ADVANCED_SEARCH) {
        await initAdvancedSearchFilters();
    }
}

function renderGenreOptions(options = GENRE_OPTIONS.map((name) => ({ name, slug: name }))) {
    const genreGrid = document.getElementById('genreGrid');
    if (!genreGrid) return;

    genreGrid.innerHTML = options.map((genre) => {
        const label = genre.name || genre.label || genre.slug || genre.value || '';
        const value = genre.slug || genre.value || genre.name || '';

        return `
        <label class="genre-checkbox">
            <input type="checkbox" name="genre" value="${escapeHtml(value)}">
            <span>${escapeHtml(label)}</span>
        </label>
    `;
    }).join('');
}

function toggleGenrePanel() {
    const panel = document.getElementById('genrePanel');
    const button = document.getElementById('genreToggleBtn');
    if (!panel || !button) return;

    const nextVisible = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = nextVisible ? 'block' : 'none';
    button.textContent = nextVisible ? 'Tutup Genre ▲' : 'Pilih Genre ▼';
}

function executeSearch() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput ? searchInput.value.trim() : '';
    redirectToSearch(keyword);
}

function redirectToSearch(keyword) {
    if (!keyword) {
        window.location.href = '/v10/search';
        return;
    }

    window.location.href = `/v10/search?q=${encodeURIComponent(keyword)}`;
}

function applyPresetFromPath() {
    document.body.classList.remove('v10-preset-airing', 'v10-preset-az', 'v10-preset-advanced', 'v10-preset-tv', 'v10-preset-movie');

    const presetMap = {
        '/v10/airing': {
            preset: 'airing',
            filters: { status: '3', order: 'updated' },
            title: 'Anime Sedang Tayang',
            description: 'Pantau anime yang masih aktif rilis episode baru — cocok untuk mengejar update mingguan dari Vidku.',
            kicker: 'Live Airing',
            sectionTitle: '🟢 Update Sedang Berjalan'
        },
        '/v10/az-list': {
            preset: 'az',
            filters: { order: 'az' },
            title: 'A-Z Anime List',
            description: 'Daftar anime Vidku urut alfabet untuk browsing cepat dan rapi.',
            kicker: 'Alphabetical',
            sectionTitle: '🔤 A-Z Anime List'
        },
        '/v10/advanced-search': {
            preset: 'advanced',
            filters: { orderby: 'popular', order: 'desc' },
            title: 'Advanced Search',
            description: 'Gabungkan filter judul, status, type, genre, producer, studio, season, dan ranking untuk cari anime dengan pola yang lebih mirip Vidku asli.',
            kicker: 'Advanced Filter',
            sectionTitle: '🎯 Hasil Advanced Search',
            openFilters: true
        },
        '/v10/tv-show': {
            preset: 'tv',
            filters: { type: 'tv', order: 'updated' },
            title: 'TV Show',
            description: 'Serial TV anime dari Vidku — filter status, genre, dan urutan tetap aktif; type default TV.',
            kicker: 'TV Series',
            sectionTitle: '📡 TV Show'
        },
        '/v10/movie': {
            preset: 'movie',
            filters: { type: 'movie', order: 'updated' },
            title: 'Movie Animes',
            description: 'Arsip movie dari Vidku dengan badge kualitas seperti HD, FHD, HEVC, atau CAM yang mengikuti halaman sumber aslinya.',
            kicker: 'Movie Collection',
            sectionTitle: '🎬 Movie Animes'
        }
    };

    const preset = presetMap[currentPath];
    if (!preset) {
        updatePageMeta({
            title: 'Semua Anime',
            description: 'Jelajahi katalog Vidku dengan filter status, type, urutan, kata kunci, dan genre.',
            kicker: 'Katalog Vidku',
            sectionTitle: '📚 Hasil Katalog Anime'
        });
        return;
    }

    currentPreset = preset.preset;
    document.body.classList.add(`v10-preset-${preset.preset}`);
    updatePageMeta({
        title: preset.title,
        description: preset.description,
        kicker: preset.kicker,
        sectionTitle: preset.sectionTitle
    });
    fillFilters(preset.filters, false);
    syncPresetFilterChrome();

    if (preset.openFilters) {
        const animeFilters = document.getElementById('animeFilters');
        const mobileFilterToggle = document.getElementById('mobileFilterToggle');
        if (animeFilters) animeFilters.classList.add('mobile-open');
        if (mobileFilterToggle) {
            mobileFilterToggle.classList.add('active');
            mobileFilterToggle.setAttribute('aria-expanded', 'true');
        }
    }
}

function syncFiltersFromQuery() {
    if (PAGE_KIND !== 'all-anime') return;

    const filters = {};
    ['title', 'status', 'type', 'order', 'orderby', 'letter', 'producer', 'studio', 'season'].forEach((key) => {
        if (currentQuery.has(key)) {
            filters[key] = currentQuery.get(key) || '';
        }
    });

    if (currentQuery.has('genre')) {
        filters.genre = currentQuery.getAll('genre');
    }

    fillFilters(filters, true);
    syncPresetFilterChrome();
}

function syncPresetFilterChrome() {
    const typeGroup = document.getElementById('filterType')?.closest('.filter-group');
    if (typeGroup) {
        const locked = currentPreset === 'tv' || currentPreset === 'movie';
        typeGroup.classList.toggle('preset-type-locked', locked);
    }

    const orderGroup = document.getElementById('filterOrder')?.closest('.filter-group');
    if (orderGroup) {
        orderGroup.classList.toggle('preset-order-az', currentPreset === 'az');
        orderGroup.classList.toggle('preset-order-airing', currentPreset === 'airing');
    }

    const statusGroup = document.getElementById('filterStatus')?.closest('.filter-group');
    if (statusGroup) {
        statusGroup.classList.toggle('preset-status-airing', currentPreset === 'airing');
    }

    syncAzLetterStrip();
}

function fillFilters(filters, preserveExistingGenres) {
    const titleInput = document.getElementById('filterTitle');
    const statusSelect = document.getElementById('filterStatus');
    const typeSelect = document.getElementById('filterType');
    const orderSelect = document.getElementById('filterOrder');
    const directionSelect = document.getElementById('filterDirection');
    const producerSelect = document.getElementById('filterProducer');
    const studioSelect = document.getElementById('filterStudio');
    const seasonSelect = document.getElementById('filterSeason');

    if (titleInput && typeof filters.title === 'string') titleInput.value = filters.title;
    if (statusSelect && typeof filters.status === 'string') statusSelect.value = filters.status;
    if (typeSelect && typeof filters.type === 'string') typeSelect.value = filters.type;

    if (orderSelect) {
        const orderValue = IS_ADVANCED_SEARCH
            ? (typeof filters.orderby === 'string' && filters.orderby ? filters.orderby : '')
            : (typeof filters.order === 'string' && filters.order ? filters.order : '')
        if (orderValue) orderSelect.value = orderValue;
    }

    if (directionSelect && typeof filters.order === 'string' && filters.order) directionSelect.value = filters.order;
    if (producerSelect && typeof filters.producer === 'string') producerSelect.value = filters.producer;
    if (studioSelect && typeof filters.studio === 'string') studioSelect.value = filters.studio;
    if (seasonSelect && typeof filters.season === 'string') seasonSelect.value = filters.season;

    if (!preserveExistingGenres && Array.isArray(filters.genre) === false) return;

    const selectedGenres = new Set(Array.isArray(filters.genre) ? filters.genre : []);
    document.querySelectorAll('#genreGrid input[name="genre"]').forEach((checkbox) => {
        checkbox.checked = selectedGenres.has(checkbox.value);
    });
}

function collectFilters() {
    const titleInput = document.getElementById('filterTitle');
    const statusSelect = document.getElementById('filterStatus');
    const typeSelect = document.getElementById('filterType');
    const orderSelect = document.getElementById('filterOrder');
    const directionSelect = document.getElementById('filterDirection');
    const producerSelect = document.getElementById('filterProducer');
    const studioSelect = document.getElementById('filterStudio');
    const seasonSelect = document.getElementById('filterSeason');
    const genres = [...document.querySelectorAll('#genreGrid input[name="genre"]:checked')].map((input) => input.value);

    return {
        title: titleInput ? titleInput.value.trim() : '',
        status: statusSelect ? statusSelect.value : '',
        type: typeSelect ? typeSelect.value : '',
        order: directionSelect ? directionSelect.value : '',
        orderby: orderSelect ? orderSelect.value : '',
        producer: producerSelect ? producerSelect.value : '',
        studio: studioSelect ? studioSelect.value : '',
        season: seasonSelect ? seasonSelect.value : '',
        genre: genres,
        catalogOrder: orderSelect ? orderSelect.value : ''
    };
}

function applyFilters() {
    const filters = collectFilters();
    const params = new URLSearchParams();

    if (filters.title) params.set('title', filters.title);
    if (filters.status) params.set('status', filters.status);
    if (filters.type) params.set('type', filters.type);
    filters.genre.forEach((genre) => params.append('genre', genre));

    if (IS_ADVANCED_SEARCH) {
        if (filters.producer) params.set('producer', filters.producer);
        if (filters.studio) params.set('studio', filters.studio);
        if (filters.season) params.set('season', filters.season);
        if (filters.orderby) params.set('orderby', filters.orderby);
        if (filters.order) params.set('order', filters.order);
        window.location.href = `/v10/advanced-search${params.toString() ? `?${params.toString()}` : ''}`;
        return;
    }

    if (filters.catalogOrder) params.set('order', filters.catalogOrder);
    window.location.href = `${currentPath}${params.toString() ? `?${params.toString()}` : ''}`;
}

function resetFilters() {
    if (IS_ADVANCED_SEARCH) {
        window.location.href = '/v10/advanced-search';
        return;
    }
    if (currentPath === '/v10/tv-show' || currentPath === '/v10/movie' || currentPath === '/v10/airing' || currentPath === '/v10/az-list') {
        window.location.href = currentPath;
        return;
    }
    window.location.href = '/v10/all-anime';
}

function loadPageData() {
    if (PAGE_KIND === 'anime-list') {
        updatePageMeta({
            title: 'Episode Terbaru',
            description: 'Feed rilis terbaru Vidku untuk langsung lanjut nonton episode yang baru turun.',
            kicker: '⚡ Fresh Episodes',
            sectionTitle: '📺 Daftar Episode Baru'
        });
        loadLatestEpisodes();
        return;
    }

    if (PAGE_KIND === 'search') {
        loadSearchResults();
        return;
    }

    if (IS_ADVANCED_SEARCH) {
        loadAdvancedSearch();
        return;
    }

    loadAllAnime();
}

async function loadLatestEpisodes() {
    document.body.classList.add('v10-preset-latest');
    showLoading('Memuat episode terbaru...');
    const response = await fetchJson(`${API_BASE}/anime-list/${currentPage}`);

    if (!response || response.status !== 'success') {
        renderEmptyState('Gagal memuat episode terbaru.');
        return;
    }

    const items = response.data?.animeData || [];
    const pagination = response.data?.paginationData || {};
    totalPages = Number(pagination.last_page || 1);
    currentPage = Number(pagination.current_page || currentPage);

    renderEpisodeCards(items);
    updateCounters(items.length, currentPage, totalPages);
    updatePagination({
        visible: totalPages > 1,
        current: currentPage,
        total: totalPages,
        onPrev: () => navigateToPage('/v10/anime-list', currentPage - 1),
        onNext: () => navigateToPage('/v10/anime-list', currentPage + 1)
    });
}

async function loadAllAnime() {
    showLoading('Memuat katalog anime...');
    const params = new URLSearchParams();
    params.set('page', String(currentPage));

    const filters = collectFiltersForRequest();
    if (filters.title) params.set('title', filters.title);
    if (filters.status) params.set('status', filters.status);
    if (filters.type) params.set('type', filters.type);
    if (filters.order) params.set('order', filters.order);
    if (filters.letter) params.set('letter', filters.letter);
    filters.genre.forEach((genre) => params.append('genre', genre));

    const response = await fetchJson(`${API_BASE}/all-anime?${params.toString()}`);

    if (!response || response.status !== 'success') {
        renderEmptyState('Gagal memuat katalog anime.');
        return;
    }

    const items = response.data?.animeData || [];
    const pagination = response.data?.pagination || {};
    totalPages = Number(pagination.last_page || 1);
    currentPage = Number(pagination.current_page || currentPage);

    renderAnimeCards(items);
    updateCounters(response.data?.total_results || items.length, currentPage, totalPages);
    updatePagination({
        visible: totalPages > 1,
        current: currentPage,
        total: totalPages,
        onPrev: () => navigateToPage(currentPath, currentPage - 1),
        onNext: () => navigateToPage(currentPath, currentPage + 1)
    });
}

async function loadAdvancedSearch() {
    showLoading('Memuat advanced search Vidku...');
    const params = new URLSearchParams();
    params.set('page', String(currentPage));

    const filters = collectFiltersForRequest();
    if (filters.title) params.set('title', filters.title);
    if (filters.orderby) params.set('orderby', filters.orderby);
    if (filters.order) params.set('order', filters.order);

    ['status', 'type', 'producer', 'studio', 'season'].forEach((field) => {
        const value = filters[field];
        if (value) params.set(field, value);
    });

    filters.genre.forEach((genre) => params.append('genre', genre));

    const response = await fetchJson(`${API_BASE}/advanced-search?${params.toString()}`);

    if (!response || response.status !== 'success') {
        renderEmptyState('Gagal memuat advanced search Vidku.');
        return;
    }

    const items = response.data?.animeData || [];
    const pagination = response.data?.pagination || {};
    totalPages = Number(pagination.last_page || 1);
    currentPage = Number(pagination.current_page || currentPage);

    renderAnimeCards(items);
    updateCounters(response.data?.total_results || items.length, currentPage, totalPages);
    updatePagination({
        visible: totalPages > 1,
        current: currentPage,
        total: totalPages,
        onPrev: () => navigateToPage(currentPath, currentPage - 1),
        onNext: () => navigateToPage(currentPath, currentPage + 1)
    });
}

async function loadSearchResults() {
    const keyword = (currentQuery.get('q') || '').trim();
    const heroSearchInput = document.getElementById('heroSearchInput');
    if (heroSearchInput) heroSearchInput.value = keyword;

    if (!keyword) {
        updatePageMeta({
            title: 'Cari Anime Vidku',
            description: 'Masukkan judul anime untuk mencari serial, movie, atau katalog terkait langsung dari Vidku.',
            kicker: 'Pencarian',
            sectionTitle: '🔎 Hasil Pencarian'
        });
        return;
    }

    showLoading('Mencari anime...');
    const response = await fetchJson(`${API_BASE}/search?q=${encodeURIComponent(keyword)}`);

    if (!response || response.status !== 'success') {
        renderEmptyState(`Gagal mencari "${keyword}".`);
        return;
    }

    const items = response.data || [];
    renderAnimeCards(items);
    updatePageMeta({
        title: `Hasil untuk "${keyword}"`,
        description: `Menampilkan hasil pencarian Vidku untuk kata kunci "${keyword}".`,
        kicker: 'Pencarian',
        sectionTitle: '🔎 Hasil Pencarian'
    });
    updateCounters(items.length, 1, 1);
    updatePagination({ visible: false });

    if (items.length === 0) {
        renderEmptyState(`Tidak ada hasil untuk "${keyword}".`);
    }
}

function collectFiltersForRequest() {
    if (PAGE_KIND !== 'all-anime') return { title: '', status: '', type: '', order: '', orderby: '', letter: '', producer: '', studio: '', season: '', genre: [] };

    if (IS_ADVANCED_SEARCH) {
        return {
            title: currentQuery.get('title') || document.getElementById('filterTitle')?.value.trim() || '',
            status: currentQuery.get('status') || document.getElementById('filterStatus')?.value || '',
            type: currentQuery.get('type') || document.getElementById('filterType')?.value || '',
            orderby: currentQuery.get('orderby') || document.getElementById('filterOrder')?.value || advancedSearchConfig?.defaults?.orderby || 'popular',
            order: currentQuery.get('order') || document.getElementById('filterDirection')?.value || advancedSearchConfig?.defaults?.order || 'desc',
            producer: currentQuery.get('producer') || document.getElementById('filterProducer')?.value || '',
            studio: currentQuery.get('studio') || document.getElementById('filterStudio')?.value || '',
            season: currentQuery.get('season') || document.getElementById('filterSeason')?.value || '',
            letter: '',
            genre: currentQuery.getAll('genre').length > 0
                ? currentQuery.getAll('genre')
                : [...document.querySelectorAll('#genreGrid input[name="genre"]:checked')].map((input) => input.value)
        };
    }

    return {
        title: currentQuery.get('title') || document.getElementById('filterTitle')?.value.trim() || '',
        status: currentQuery.get('status') || document.getElementById('filterStatus')?.value || '',
        type: currentQuery.get('type') || document.getElementById('filterType')?.value || '',
        order: currentQuery.get('order') || document.getElementById('filterOrder')?.value || 'updated',
        letter: currentQuery.get('letter') || '',
        genre: currentQuery.getAll('genre').length > 0
            ? currentQuery.getAll('genre')
            : [...document.querySelectorAll('#genreGrid input[name="genre"]:checked')].map((input) => input.value)
    };
}

async function initAdvancedSearchFilters() {
    setAdvancedFieldsVisibility(true);
    setAdvancedSearchLabels();

    const response = await fetchJson(`${API_BASE}/advanced-search/config`);
    if (!response || response.status !== 'success') {
        return;
    }

    advancedSearchConfig = response.data || null;
    const options = advancedSearchConfig?.options || {};

    populateSelectOptions('filterStatus', options.status, 'Semua Status');
    populateSelectOptions('filterType', options.type, 'Semua Type');
    populateSelectOptions('filterProducer', options.producer, 'Semua Producer');
    populateSelectOptions('filterStudio', options.studio, 'Semua Studio');
    populateSelectOptions('filterSeason', options.season, 'Semua Season');
    populateSelectOptions('filterOrder', options.orderby, 'Pilih Urutan');
    populateSelectOptions('filterDirection', options.order, 'Pilih Arah');
    renderGenreOptions(options.genre || []);

    fillFilters({
        orderby: advancedSearchConfig?.defaults?.orderby || 'popular',
        order: advancedSearchConfig?.defaults?.order || 'desc'
    }, false);
}

function setAdvancedFieldsVisibility(visible) {
    document.querySelectorAll('.advanced-only').forEach((element) => {
        element.hidden = !visible;
    });
}

function setAdvancedSearchLabels() {
    const orderLabel = document.getElementById('filterOrderLabel');
    const genreLabel = document.getElementById('genreLabel');
    const genreToggleBtn = document.getElementById('genreToggleBtn');

    if (orderLabel) orderLabel.textContent = 'Urutan Vidku';
    if (genreLabel) genreLabel.textContent = 'Genre Multi-Select';
    if (genreToggleBtn) genreToggleBtn.textContent = 'Pilih Genre Advanced ▼';
}

function populateSelectOptions(elementId, options, emptyLabel) {
    const select = document.getElementById(elementId);
    if (!select) return;

    const optionList = Array.isArray(options) ? options : [];
    select.innerHTML = [
        `<option value="">${escapeHtml(emptyLabel)}</option>`,
        ...optionList.map((option) => {
            const label = option.label || option.name || option.slug || option.value || '';
            const value = option.value || option.slug || option.name || '';
            return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
        })
    ].join('');
}

function navigateToPage(path, nextPage) {
    if (nextPage < 1 || nextPage > totalPages) return;

    const params = new URLSearchParams(window.location.search);
    params.set('page', String(nextPage));
    window.location.href = `${path}?${params.toString()}`;
}

function renderEpisodeCards(items) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    if (items.length === 0) {
        renderEmptyState('Belum ada episode terbaru untuk ditampilkan.');
        return;
    }

    container.innerHTML = items.map((item, index) => {
        const episodeLabel = item.episode_number ? `Episode ${escapeHtml(String(item.episode_number))}` : 'Episode Baru';
        const title = item.title || item.full_title || 'Episode';
        const subtitle = item.full_title && item.full_title !== item.title ? item.full_title : 'Buka halaman episode terbaru';
        return `
        <article class="anime-card latest-episode-card${index === 0 && currentPage === 1 ? ' latest-first-drop' : ''}" onclick="window.location.href='/v10/episode?slug=${encodeURIComponent(item.slug)}'" role="link" tabindex="0">
            <div class="anime-poster latest-episode-poster">
                <img src="${escapeHtml(item.poster || '/placeholder.jpg')}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">
                <div class="anime-overlay latest-overlay">
                    <span class="latest-new-badge">NEW</span>
                    ${item.type ? `<span class="anime-type">${escapeHtml(item.type)}</span>` : '<span class="anime-type">Episode</span>'}
                </div>
                <span class="latest-episode-badge">${episodeLabel}</span>
            </div>
            <div class="anime-info">
                <h3 class="anime-title">${escapeHtml(title)}</h3>
                <div class="meta-stack">
                    <span class="result-subtitle">${escapeHtml(subtitle)}</span>
                    <span class="latest-watch-link">Tonton episode →</span>
                </div>
            </div>
        </article>
    `;
    }).join('');

    container.querySelectorAll('.latest-episode-card[role="link"]').forEach((card) => {
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                card.click();
            }
        });
    });
}

function renderAnimeCards(items) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    if (items.length === 0) {
        renderEmptyState('Tidak ada anime yang cocok dengan filter saat ini.');
        return;
    }

    const tvCardClass = isTvPreset() ? ' tv-series-card' : '';
    const advancedCardClass = isAdvancedPreset() ? ' advanced-result-card' : '';
    const azCardClass = isAzPreset() ? ' az-list-card' : '';
    const airingCardClass = isAiringPreset() ? ' airing-live-card' : '';

    container.innerHTML = items.map((item) => `
        <article class="anime-card${tvCardClass}${advancedCardClass}${azCardClass}${airingCardClass}" onclick="window.location.href='/v10/detail?slug=${encodeURIComponent(item.slug)}'">
            <div class="anime-poster">
                <img src="${escapeHtml(item.poster || '/placeholder.jpg')}" alt="${escapeHtml(item.title || 'Anime')}" loading="lazy">
                <div class="anime-overlay">
                    ${item.rating ? `<div class="anime-rating">${escapeHtml(item.rating)}</div>` : ''}
                    ${renderOverlayTypeBadge(item)}
                </div>
            </div>
            <div class="anime-info">
                <h3 class="anime-title">${escapeHtml(item.title || 'Tanpa Judul')}</h3>
                <div class="meta-stack">
                    ${renderPrimaryStatusBadge(item)}
                    ${item.episode_number ? `<span class="anime-episode">${escapeHtml(String(item.episode_number))}</span>` : ''}
                    ${renderSecondaryMovieBadge(item)}
                </div>
                ${(item.genres || []).length > 0 ? `
                    <div class="anime-genres">
                        ${item.genres.slice(0, 3).map((genre) => `<span class="genre-tag">${escapeHtml(genre.name || '')}</span>`).join('')}
                    </div>
                ` : `<span class="result-subtitle">${escapeHtml(renderResultSubtitle(item))}</span>`}
            </div>
        </article>
    `).join('');
}

function renderOverlayTypeBadge(item) {
    if (isMoviePreset() && item.quality_badge) {
        return `<div class="anime-quality">${escapeHtml(item.quality_badge)}</div>`;
    }

    if (isTvPreset()) {
        const label = item.type || 'TV';
        return `<div class="anime-type">${escapeHtml(label)}</div>`;
    }

    return item.type ? `<div class="anime-type">${escapeHtml(item.type)}</div>` : '';
}

function renderPrimaryStatusBadge(item) {
    if (isMoviePreset()) {
        if (item.type) {
            return `<span class="anime-type">${escapeHtml(item.type)}</span>`;
        }
        if (item.status && item.status.toLowerCase() !== 'movie') {
            return `<span class="anime-status">${escapeHtml(item.status)}</span>`;
        }
        return '';
    }

    return item.status ? `<span class="anime-status">${escapeHtml(item.status)}</span>` : '';
}

function renderSecondaryMovieBadge(item) {
    if (!isMoviePreset()) return '';
    if (!item.status || item.status.toLowerCase() === String(item.type || '').toLowerCase()) return '';
    return `<span class="anime-status">${escapeHtml(item.status)}</span>`;
}

function renderResultSubtitle(item) {
    if (isMoviePreset()) {
        if (item.quality_badge) return item.quality_badge;
        if (item.status && item.status.toLowerCase() !== 'movie') return item.status;
    }

    return 'Buka detail anime';
}

const AZ_LETTER_NAV = ['#', '0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

function isAzPreset() {
    return currentPreset === 'az' || currentPath === '/v10/az-list';
}

function syncAzLetterStrip() {
    const strip = document.getElementById('azLetterStrip');
    const scroll = document.getElementById('azLetterStripScroll');
    if (!strip || !scroll) return;

    const show = isAzPreset();
    strip.hidden = !show;
    if (!show) return;

    const activeLetter = (currentQuery.get('letter') || '').trim();
    if (!scroll.dataset.bound) {
        scroll.dataset.bound = '1';
        scroll.addEventListener('click', (event) => {
            const btn = event.target.closest('.az-letter-btn');
            if (!btn) return;
            navigateAzLetter(btn.dataset.letter ?? '');
        });
    }

    const allActive = !activeLetter;
    const allBtn = `<button type="button" class="az-letter-btn az-letter-btn-all${allActive ? ' active' : ''}" data-letter="" role="listitem">Semua</button>`;
    const letterBtns = AZ_LETTER_NAV.map((letter) => {
        const active = activeLetter.toLowerCase() === String(letter).toLowerCase()
            || (letter.length === 1 && letter !== '#' && activeLetter.toUpperCase() === letter);
        return `<button type="button" class="az-letter-btn${active ? ' active' : ''}" data-letter="${escapeHtml(letter)}" role="listitem">${escapeHtml(letter)}</button>`;
    }).join('');
    scroll.innerHTML = allBtn + letterBtns;
}

function navigateAzLetter(letter) {
    const params = new URLSearchParams(window.location.search);
    params.delete('page');
    const normalized = String(letter || '').trim();
    if (normalized) {
        params.set('letter', normalized);
    } else {
        params.delete('letter');
    }
    if (!params.has('order')) {
        params.set('order', 'az');
    }
    const qs = params.toString();
    window.location.href = `/v10/az-list${qs ? `?${qs}` : ''}`;
}

function isMoviePreset() {
    return currentPreset === 'movie' || currentPath === '/v10/movie';
}

function isTvPreset() {
    return currentPreset === 'tv' || currentPath === '/v10/tv-show';
}

function isAdvancedPreset() {
    return currentPreset === 'advanced' || currentPath === '/v10/advanced-search';
}

function isAiringPreset() {
    return currentPreset === 'airing' || currentPath === '/v10/airing';
}

function showLoading(message) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    container.innerHTML = `<div class="loading">${escapeHtml(message)}</div>`;
}

function renderEmptyState(message) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function updateCounters(totalItems, current, total) {
    const resultCount = document.getElementById('resultCount');
    const pageCount = document.getElementById('pageCount');
    const sectionBadge = document.getElementById('sectionBadge');

    if (resultCount) resultCount.textContent = String(totalItems || 0);
    if (pageCount) pageCount.textContent = `${current} / ${total}`;
    if (sectionBadge) sectionBadge.textContent = `${totalItems || 0} item`;
}

function updatePagination(config) {
    const paginationContainer = document.getElementById('paginationContainer');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const paginationInfo = document.getElementById('paginationInfo');

    if (!paginationContainer) return;

    if (!config.visible) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'block';

    if (paginationInfo) {
        paginationInfo.textContent = `Halaman ${config.current} dari ${config.total}`;
    }

    if (prevPageBtn) {
        prevPageBtn.disabled = config.current <= 1;
        prevPageBtn.onclick = config.onPrev || null;
    }

    if (nextPageBtn) {
        nextPageBtn.disabled = config.current >= config.total;
        nextPageBtn.onclick = config.onNext || null;
    }
}

function updatePageMeta(meta) {
    const pageTitle = document.getElementById('pageTitle');
    const pageDescription = document.getElementById('pageDescription');
    const pageKicker = document.getElementById('pageKicker');
    const sectionTitle = document.getElementById('sectionTitle');

    if (pageTitle && meta.title) pageTitle.textContent = meta.title;
    if (pageDescription && meta.description) pageDescription.textContent = meta.description;
    if (pageKicker && meta.kicker) pageKicker.textContent = meta.kicker;
    if (sectionTitle && meta.sectionTitle) sectionTitle.textContent = meta.sectionTitle;
    if (meta.title) document.title = `AnimMe V10 - ${meta.title}`;
}

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[V10] Request failed:', error);
        return null;
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
