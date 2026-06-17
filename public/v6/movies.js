// AnimMe V6 - AnimeIndo Movies Page
const API_BASE = '/api/v6/animeindo';

const movieState = {
    page: 1,
    movies: [],
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
    loadMovies(1);
});

async function loadMovies(page = 1) {
    movieState.isLoading = true;
    movieState.page = page;
    showLoading();
    hideError();

    try {
        const response = await fetch(`${API_BASE}/movies?page=${page}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Data tidak valid');
        }

        movieState.movies = Array.isArray(payload.data.movies) ? payload.data.movies : [];
        movieState.pagination = payload.data.pagination || movieState.pagination;
        renderMovies();
        renderPagination();
    } catch (error) {
        console.error('[V6] Movies API error:', error);
        showError('Gagal memuat daftar movie.');
        renderFallback();
    } finally {
        movieState.isLoading = false;
    }
}

function renderMovies() {
    const container = document.getElementById('movieContainer');
    if (!container) return;

    if (!movieState.movies.length) {
        container.innerHTML = `
            <div class="error" style="background:rgba(52,152,219,0.12);color:rgba(226,239,255,0.75);border-radius:10px;">
                Tidak ada movie pada halaman ini.
            </div>
        `;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'movie-grid';

    movieState.movies.forEach((movie) => {
        const card = document.createElement('div');
        card.className = 'movie-card';

        const posterUrl = movie.poster || movie.poster_original || '/images/placeholder.jpg';
        const slug = movie.slug || '';
        const detailLink = slug ? `/v6/detail?slug=${encodeURIComponent(normalizeDetailSlug(slug))}` : (movie.url || '#');
        const linkAttrs = slug ? `href="${detailLink}"` : `href="${detailLink}" target="_blank" rel="noopener"`;

        card.innerHTML = `
            <div class="movie-poster" style="background-image:url('${posterUrl}');"></div>
            <div class="movie-info">
                <a class="movie-title" ${linkAttrs}>
                    ${escapeHtml(movie.title || 'Movie')}
                </a>
                <div class="movie-labels">
                    ${(movie.labels || []).map(label => `<span class="movie-label">${escapeHtml(label)}</span>`).join('')}
                </div>
                <div class="movie-description">${escapeHtml(movie.description || 'Deskripsi tidak tersedia.')}</div>
            </div>
        `;

        grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

function renderPagination() {
    const paginationEl = document.getElementById('moviePagination');
    const prevBtn = document.getElementById('prevMoviesBtn');
    const nextBtn = document.getElementById('nextMoviesBtn');
    const pagination = movieState.pagination || {};

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
        if (!hasPrev || movieState.isLoading) return;
        const target = pagination.previous_page || Math.max(1, movieState.page - 1);
        loadMovies(target);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    nextBtn.onclick = () => {
        if (!hasNext || movieState.isLoading) return;
        const target = pagination.next_page || movieState.page + 1;
        loadMovies(target);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

function renderFallback() {
    const container = document.getElementById('movieContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="error">
            Tidak dapat menampilkan daftar movie.
        </div>
    `;
}

function showLoading() {
    const container = document.getElementById('movieContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Memuat daftar movie...</p>
        </div>
    `;
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
    errorContainer.style.display = 'block';
    movieState.error = message;
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    movieState.error = null;
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

console.log('[V6] AnimeIndo movie page initialized');
