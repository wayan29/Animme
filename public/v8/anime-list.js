const API_BASE = '/api/v8/kusonime';
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image';
const ALLOWED_KINDS = new Set(['all', 'bd', 'movie', 'live-action', 'ova', 'special', 'ona']);

function asText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text || fallback;
}

function safePositiveInt(value, fallback = 1) {
    const number = parseInt(value, 10);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function safeImageUrl(value) {
    const raw = asText(value);
    if (!raw) return PLACEHOLDER_IMAGE;

    try {
        const url = new URL(raw, window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : PLACEHOLDER_IMAGE;
    } catch {
        return PLACEHOLDER_IMAGE;
    }
}

function clearElement(element) {
    while (element?.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function buildDetailUrl(slug) {
    return `/v8/detail.html?slug=${encodeURIComponent(asText(slug))}`;
}

function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
}

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

function getState() {
    const params = new URLSearchParams(window.location.search);
    const page = Math.min(1000, safePositiveInt(params.get('page'), 1));
    const requestedKind = asText(params.get('kind'), 'all').toLowerCase();
    const kind = ALLOWED_KINDS.has(requestedKind) ? requestedKind : 'all';
    const genre = asText(params.get('genre'));
    const season = asText(params.get('season'));
    const name = asText(params.get('name'));

    return { page, kind, genre, season, name };
}

function buildPageUrl(page) {
    const state = getState();
    const safePage = Math.min(1000, safePositiveInt(page, 1));
    const params = new URLSearchParams();

    if (state.kind && state.kind !== 'all') params.set('kind', state.kind);
    if (state.genre) params.set('genre', state.genre);
    if (state.season) params.set('season', state.season);
    if (state.name) params.set('name', state.name);
    if (safePage > 1) params.set('page', safePage);

    const query = params.toString();
    return `/v8/anime-list${query ? `?${query}` : ''}`;
}

function renderPagination(pagination) {
    const container = document.getElementById('paginationContainer');
    const info = document.getElementById('paginationInfo');
    const buttons = document.getElementById('paginationButtons');

    if (!container || !info || !buttons) return;
    clearElement(buttons);

    const currentPage = safePositiveInt(pagination?.current_page, getState().page);
    const lastPage = safePositiveInt(pagination?.last_page, 1);
    const previousPage = safePositiveInt(pagination?.previous_page, currentPage - 1);
    const nextPage = safePositiveInt(pagination?.next_page, currentPage + 1);
    const hasPreviousPage = Boolean(pagination?.has_previous_page) && currentPage > 1;
    const hasNextPage = Boolean(pagination?.has_next_page) && currentPage < lastPage;

    if (!pagination || (!hasPreviousPage && !hasNextPage && lastPage <= 1)) {
        container.style.display = 'none';
        info.textContent = '';
        return;
    }

    container.style.display = '';
    info.textContent = `Halaman ${currentPage} dari ${lastPage}`;

    buttons.appendChild(createPaginationButton('← Sebelumnya', previousPage, { disabled: !hasPreviousPage }));

    const pages = new Set([1, currentPage - 1, currentPage, currentPage + 1, lastPage]);
    const pageNumbers = Array.from(pages)
        .filter(page => page >= 1 && page <= lastPage)
        .sort((a, b) => a - b);

    let previous = 0;
    for (const page of pageNumbers) {
        if (page - previous > 1) {
            buttons.appendChild(createTextElement('span', 'pagination-dots', '...'));
        }

        buttons.appendChild(createPaginationButton(String(page), page, {
            active: page === currentPage,
            disabled: page === currentPage
        }));
        previous = page;
    }

    buttons.appendChild(createPaginationButton('Berikutnya →', nextPage, { disabled: !hasNextPage }));
}

function createPaginationButton(label, page, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pagination-btn${options.active ? ' active' : ''}${options.disabled ? ' disabled' : ''}`;
    button.textContent = label;
    button.disabled = Boolean(options.disabled);

    if (!button.disabled) {
        button.addEventListener('click', () => goToPage(page));
    }

    return button;
}

function updateCategoryNav(state) {
    const nav = document.getElementById('categoryNav');
    if (!nav) return;

    if (state.genre || state.season) {
        nav.style.display = 'none';
        return;
    }

    nav.style.display = 'flex';
    nav.querySelectorAll('.category-pill').forEach((item) => {
        item.classList.toggle('active', item.dataset.kind === state.kind);
    });
}

function renderStatus(container, message, className = 'error', withRetry = false) {
    clearElement(container);
    container.className = className;
    const wrapper = createTextElement('div', className, message);

    if (withRetry) {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'pagination-btn';
        retryButton.textContent = 'Coba Lagi';
        retryButton.style.marginTop = '12px';
        retryButton.addEventListener('click', loadPage);
        wrapper.appendChild(document.createElement('br'));
        wrapper.appendChild(retryButton);
    }

    container.appendChild(wrapper);
}

function renderSimpleList(items, container) {
    clearElement(container);
    container.className = 'simple-list';

    const fragment = document.createDocumentFragment();
    items.forEach(item => {
        const slug = asText(item.slug);
        const link = document.createElement('a');
        link.className = 'simple-list-item';
        link.href = slug ? buildDetailUrl(slug) : '#';
        link.textContent = asText(item.title, 'Untitled');
        fragment.appendChild(link);
    });

    container.appendChild(fragment);
}

function renderCardList(items, container) {
    clearElement(container);
    container.className = 'catalog-grid';

    const fragment = document.createDocumentFragment();
    items.forEach(item => fragment.appendChild(createCatalogCard(item)));
    container.appendChild(fragment);
}

function createCatalogCard(item = {}) {
    const card = document.createElement('div');
    card.className = 'catalog-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');

    const slug = asText(item.slug);
    if (slug) {
        card.addEventListener('click', () => goToDetail(slug));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                goToDetail(slug);
            }
        });
    }

    const title = asText(item.title, 'Untitled');
    const thumb = document.createElement('div');
    thumb.className = 'catalog-thumb';

    const image = document.createElement('img');
    image.src = safeImageUrl(item.poster);
    image.alt = title;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
        if (image.src !== PLACEHOLDER_IMAGE) {
            image.src = PLACEHOLDER_IMAGE;
        }
    }, { once: true });
    thumb.appendChild(image);

    const info = document.createElement('div');
    info.className = 'catalog-info';
    info.appendChild(createTextElement('div', 'catalog-title', title));

    const meta = document.createElement('div');
    meta.className = 'catalog-meta';
    meta.appendChild(createTextElement('span', 'meta-pill', asText(item.release_date, 'Unknown')));
    meta.appendChild(createTextElement('span', 'meta-pill', asText(item.author, 'Admin')));
    info.appendChild(meta);

    const genres = document.createElement('div');
    genres.className = 'catalog-meta';
    const genreList = Array.isArray(item.genres) ? item.genres.slice(0, 3) : [];
    if (genreList.length > 0) {
        genreList.forEach(genre => genres.appendChild(createTextElement('span', 'genre-tag', asText(genre, 'Batch'))));
    }
    info.appendChild(genres);

    card.appendChild(thumb);
    card.appendChild(info);
    return card;
}

async function loadPage() {
    const state = getState();
    const pageTitle = document.getElementById('pageTitle');
    const pageDescription = document.getElementById('pageDescription');
    const sectionTitle = document.getElementById('sectionTitle');
    const countBadge = document.getElementById('countBadge');
    const resultsContainer = document.getElementById('resultsContainer');

    if (!resultsContainer || !pageTitle || !pageDescription || !sectionTitle || !countBadge) return;

    let endpoint = `/anime-list?page=${encodeURIComponent(state.page)}&kind=${encodeURIComponent(state.kind)}`;
    let title = 'Anime List Kusonime';
    let description = 'Daftar alfabet anime batch Kusonime.';
    let mode = 'anime-list';

    if (state.genre) {
        endpoint = `/genre/${encodeURIComponent(state.genre)}?page=${encodeURIComponent(state.page)}`;
        title = `Genre: ${state.name || state.genre}`;
        description = 'Koleksi anime batch berdasarkan genre pilihan.';
        mode = 'genre';
    } else if (state.season) {
        endpoint = `/season/${encodeURIComponent(state.season)}?page=${encodeURIComponent(state.page)}`;
        title = `Tahun Rilis: ${state.name || state.season}`;
        description = 'Koleksi anime batch berdasarkan musim dan tahun rilis.';
        mode = 'season';
    }

    pageTitle.textContent = title;
    sectionTitle.textContent = title;
    pageDescription.textContent = description;
    countBadge.textContent = 'Memuat...';
    updateCategoryNav(state);
    renderStatus(resultsContainer, 'Memuat data...', 'loading');

    const response = await fetchAPI(endpoint);
    if (!response || !response.data) {
        countBadge.textContent = '0 item';
        renderStatus(resultsContainer, 'Gagal memuat data.', 'error', true);
        renderPagination(null);
        return;
    }

    const data = response.data;
    const effectiveMode = mode === 'anime-list' ? (data.mode || 'anime-list') : mode;
    const items = effectiveMode === 'list' || effectiveMode === 'anime-list'
        ? (Array.isArray(data.anime_list) ? data.anime_list : [])
        : (Array.isArray(data.latest_releases) ? data.latest_releases : []);

    countBadge.textContent = `${items.length} item`;

    if (!items.length) {
        renderStatus(resultsContainer, 'Tidak ada data untuk ditampilkan.', 'empty-state');
        renderPagination(data.pagination || null);
        return;
    }

    if (effectiveMode === 'list' || effectiveMode === 'anime-list') {
        renderSimpleList(items, resultsContainer);
    } else {
        renderCardList(items, resultsContainer);
    }

    renderPagination(data.pagination || null);
}

function goToPage(page) {
    window.location.href = buildPageUrl(page);
}

function goToDetail(slug) {
    const safeSlug = asText(slug);
    if (safeSlug) {
        window.location.href = buildDetailUrl(safeSlug);
    }
}

function searchAnime() {
    const keyword = asText(document.getElementById('searchInput')?.value);
    if (!keyword) {
        alert('Masukkan kata kunci pencarian!');
        return;
    }

    window.location.href = `/v8/search.html?q=${encodeURIComponent(keyword)}`;
}

function bindEvents() {
    document.getElementById('searchButton')?.addEventListener('click', searchAnime);
    document.getElementById('searchInput')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            searchAnime();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadPage();
});
