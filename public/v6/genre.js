// AnimMe V6 - AnimeIndo Genre Detail Page
const API_BASE = '/api/v6/animeindo';

const genreDetailState = {
    slug: null,
    name: '',
    page: 1,
    animeList: [],
    pagination: {
        current_page: 1,
        has_next_page: false,
        has_previous_page: false,
        next_page: null,
        previous_page: null
    },
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    initializeGenreDetail();
});

function initializeGenreDetail() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug') || params.get('s') || '';
    const page = parseInt(params.get('page'), 10) || 1;
    const name = params.get('name') || '';

    if (!slug) {
        showError('Parameter slug genre tidak ditemukan.');
        renderFallback();
        return;
    }

    genreDetailState.slug = slug;
    genreDetailState.page = page;
    if (name) {
        genreDetailState.name = name;
        updateTitles();
    }

    loadGenreDetail(slug, page);
}

async function loadGenreDetail(slug, page = 1) {
    genreDetailState.isLoading = true;
    showLoading();
    hideError();

    try {
        const response = await fetch(`${API_BASE}/genres/${encodeSlug(slug)}?page=${page}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Data tidak valid');
        }

        const data = payload.data;
        genreDetailState.page = data.current_page || page;
        genreDetailState.animeList = Array.isArray(data.anime_list) ? data.anime_list : [];
        genreDetailState.pagination = data.pagination || genreDetailState.pagination;
        genreDetailState.name = data.genre || genreDetailState.name || slug;

        updateTitles();
        renderGenreAnime();
        renderPagination();
    } catch (error) {
        console.error('[V6] Genre detail API error:', error);
        showError('Gagal memuat daftar anime untuk genre ini.');
        renderFallback();
    } finally {
        genreDetailState.isLoading = false;
    }
}

function renderGenreAnime() {
    const container = document.getElementById('genreAnimeContainer');
    if (!container) return;

    if (!genreDetailState.animeList.length) {
        container.innerHTML = `
            <div class="error" style="background:rgba(52,152,219,0.12);color:rgba(226,239,255,0.75);border-radius:10px;">
                Belum ada anime pada halaman ini.
            </div>
        `;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'anime-grid';

    genreDetailState.animeList.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'anime-card';

        const poster = item.poster || item.poster_original || '/images/placeholder.jpg';
        const title = escapeHtml(item.title || 'Anime');
        const description = escapeHtml(item.description || 'Deskripsi tidak tersedia.');
        const labels = (item.labels || []).map(label => `<span class="anime-label">${escapeHtml(label)}</span>`).join('');
        const slug = item.slug || '';
        const detailLink = slug ? `/v6/detail?slug=${encodeURIComponent(normalizeDetailSlug(slug))}` : (item.url || '#');
        const linkAttrs = slug ? `href="${detailLink}"` : `href="${detailLink}" target="_blank" rel="noopener"`;

        card.innerHTML = `
            <div class="anime-poster" style="background-image:url('${poster}')"></div>
            <div class="anime-info">
                <a class="anime-title" ${linkAttrs}>${title}</a>
                <div class="anime-labels">${labels}</div>
                <div class="anime-description">${description}</div>
            </div>
        `;

        grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

function renderPagination() {
    const paginationEl = document.getElementById('genrePagination');
    const prevBtn = document.getElementById('prevGenreBtn');
    const nextBtn = document.getElementById('nextGenreBtn');
    const pagination = genreDetailState.pagination || {};

    if (!paginationEl || !prevBtn || !nextBtn) return;

    const hasPrev = Boolean(pagination.has_previous_page && pagination.previous_page);
    const hasNext = Boolean(pagination.has_next_page && pagination.next_page);

    if (!hasPrev && !hasNext) {
        paginationEl.style.display = 'none';
        return;
    }

    paginationEl.style.display = 'flex';
    prevBtn.disabled = !hasPrev;
    nextBtn.disabled = !hasNext;

    prevBtn.onclick = () => {
        if (!hasPrev || genreDetailState.isLoading) return;
        const target = pagination.previous_page || Math.max(1, genreDetailState.page - 1);
        navigateToPage(target);
    };

    nextBtn.onclick = () => {
        if (!hasNext || genreDetailState.isLoading) return;
        const target = pagination.next_page || genreDetailState.page + 1;
        navigateToPage(target);
    };
}

function navigateToPage(page) {
    const params = new URLSearchParams(window.location.search);
    params.set('page', page);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    loadGenreDetail(genreDetailState.slug, page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderFallback() {
    const container = document.getElementById('genreAnimeContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="error">
            Tidak dapat menampilkan daftar anime.
        </div>
    `;
}

function showLoading() {
    const container = document.getElementById('genreAnimeContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Memuat daftar anime genre...</p>
        </div>
    `;
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
    errorContainer.style.display = 'block';
    genreDetailState.error = message;
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    genreDetailState.error = null;
}

function updateTitles() {
    const genreName = genreDetailState.name || genreDetailState.slug || 'Genre';
    const titleEl = document.getElementById('genreTitle');
    const topbarTitle = document.getElementById('topbarTitle');

    if (titleEl) titleEl.textContent = `Genre ${genreName}`;
    if (topbarTitle) topbarTitle.textContent = `AnimMe V6 - Genre ${genreName}`;
    document.title = `AnimMe V6 - Genre ${genreName}`;
}

function encodeSlug(slug) {
    return slug
        .split('/')
        .filter(Boolean)
        .map(encodeURIComponent)
        .join('/');
}

function escapeHtml(text = '') {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

function normalizeDetailSlug(slug = '') {
    if (!slug) return '';
    return slug.startsWith('anime/') ? slug : `anime/${slug}`;
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!menuToggle || !sidebar) return;

    const openSidebar = () => {
        sidebar.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
        document.body.classList.add('sidebar-open');
    };

    const closeSidebar = () => {
        sidebar.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';
    };

    menuToggle.addEventListener('click', openSidebar);

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', closeSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchInput = document.getElementById('searchInput');
    const searchContainer = document.querySelector('.search-container');

    if (!searchIconBtn || !searchContainer) return;

    searchIconBtn.addEventListener('click', () => {
        searchContainer.classList.add('active');
        if (searchInput) searchInput.focus();
    });

    if (searchCloseBtn) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer.classList.remove('active');
            if (searchInput) searchInput.value = '';
        });
    }
}

function setupSearchHandler() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    if (searchBtn) {
        searchBtn.addEventListener('click', searchAnime);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                searchAnime();
            }
        });
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (!query) return;

    window.location.href = `/v6/search?q=${encodeURIComponent(query)}`;
}

function setupServerSelector() {
    const selector = document.getElementById('serverSelect');
    if (!selector) return;

    selector.value = 'v6';

    selector.addEventListener('change', (event) => {
        const version = event.target.value;
        switch (version) {
            case 'v1':
                window.location.href = '/v1/home';
                break;
            case 'v2':
                window.location.href = '/v2/home';
                break;
            case 'v3':
                window.location.href = '/v3/home';
                break;
            case 'v4':
                window.location.href = '/v4/home';
                break;
            case 'v5':
                window.location.href = '/v5/home';
                break;
            case 'v6':
                window.location.href = '/v6/home';
                break;
            default:
                window.location.href = '/';
        }
    });
}

console.log('[V6] AnimeIndo genre detail page initialized');
