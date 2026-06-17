// AnimMe V6 - AnimeIndo Home Application
const API_BASE = '/api/v6/animeindo';

const appState = {
    page: 1,
    updateTerbaru: [],
    popular: [],
    pagination: {
        current_page: 1,
        has_next_page: false,
        has_previous_page: false
    },
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupPaginationControls();
    setupSearchHandler();
});

async function initializeApp() {
    try {
        await loadHomePage(1);
    } catch (error) {
        console.error('[V6] Failed to initialize home:', error);
        showError('Terjadi kesalahan saat memuat data dari AnimeIndo.');
    }
}

async function loadHomePage(page = 1) {
    appState.isLoading = true;
    appState.page = page;
    hideError();
    showLoadingState();

    try {
        const response = await fetch(`${API_BASE}/home?page=${page}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Respon dari server tidak valid');
        }

        const { update_terbaru, popular, pagination } = payload.data;

        appState.updateTerbaru = Array.isArray(update_terbaru) ? update_terbaru : [];
        if (page === 1 && Array.isArray(popular)) {
            appState.popular = popular;
        } else if (page === 1 && !Array.isArray(popular) && appState.popular.length === 0) {
            appState.popular = [];
        }
        appState.pagination = pagination || { current_page: page };

        renderUpdateTerbaru();
        renderPopular();
        renderPagination();
    } catch (error) {
        console.error('[V6] Home API error:', error);
        showError('Gagal memuat data homepage AnimeIndo.');
        renderFallbackState();
    } finally {
        appState.isLoading = false;
    }
}

function showLoadingState() {
    const updateList = document.getElementById('updateList');
    const popularList = document.getElementById('popularList');

    if (updateList) {
        updateList.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat update terbaru dari AnimeIndo...</p>
            </div>
        `;
    }

    if (popularList && appState.popular.length === 0) {
        popularList.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat daftar anime populer...</p>
            </div>
        `;
    }
}

function renderUpdateTerbaru() {
    const container = document.getElementById('updateList');
    const countBadge = document.getElementById('updateCount');

    if (!container) return;

    if (!appState.updateTerbaru.length) {
        container.innerHTML = `
            <div class="loading">
                <p>Tidak ada update terbaru yang tersedia.</p>
            </div>
        `;
        if (countBadge) countBadge.textContent = '0';
        return;
    }

    container.innerHTML = '';
    appState.updateTerbaru.forEach((item) => {
        const poster = item.poster || '/images/placeholder.jpg';
        const episodeLabel = item.episode ? escapeHtml(item.episode) : null;
        const title = escapeHtml(item.title || 'Judul tidak tersedia');

        const card = document.createElement('a');
        card.className = 'update-card';

        const slug = item.slug || '';
        if (slug) {
            const linkTarget = item.episode
                ? `/v6/episode?slug=${encodeURIComponent(slug)}`
                : `/v6/detail?slug=${encodeURIComponent(normalizeDetailSlug(slug))}`;
            card.href = linkTarget;
        } else {
            card.href = item.url || '#';
            card.target = '_blank';
            card.rel = 'noopener';
        }

        card.innerHTML = `
            <div class="update-poster" style="background-image: url('${poster}');">
                ${episodeLabel ? `<span class="update-episode">Episode ${episodeLabel}</span>` : ''}
            </div>
            <div class="update-info">
                <div class="update-title">${title}</div>
                <div class="update-meta">Sumber: AnimeIndo</div>
            </div>
        `;

        container.appendChild(card);
    });

    if (countBadge) countBadge.textContent = String(appState.updateTerbaru.length);
}

function renderPopular() {
    const container = document.getElementById('popularList');
    const countBadge = document.getElementById('popularCount');

    if (!container) return;

    if (!appState.popular.length) {
        container.innerHTML = `
            <div class="loading">
                <p>Data anime populer belum tersedia.</p>
            </div>
        `;
        if (countBadge) countBadge.textContent = '0';
        return;
    }

    container.innerHTML = '';

    appState.popular.forEach((item) => {
        const wrapper = document.createElement('a');
        wrapper.className = 'popular-item';

        if (item.slug) {
            wrapper.href = `/v6/detail?slug=${encodeURIComponent(normalizeDetailSlug(item.slug))}`;
        } else {
            wrapper.href = item.url || '#';
            wrapper.target = '_blank';
            wrapper.rel = 'noopener';
        }

        const poster = item.poster || '/images/placeholder.jpg';
        const title = escapeHtml(item.title || 'Judul tidak tersedia');
        const description = escapeHtml(item.description || 'Genre tidak tersedia');

        wrapper.innerHTML = `
            <div class="popular-thumb" style="background-image: url('${poster}');"></div>
            <div class="popular-info">
                <div class="popular-title">${title}</div>
                <div class="popular-desc">${description}</div>
            </div>
        `;

        container.appendChild(wrapper);
    });

    if (countBadge) countBadge.textContent = String(appState.popular.length);
}

function renderPagination() {
    const controls = document.getElementById('paginationControls');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pagination = appState.pagination || {};

    if (!controls || !prevBtn || !nextBtn) return;

    const hasPrev = Boolean(pagination.has_previous_page);
    const hasNext = Boolean(pagination.has_next_page);

    if (!hasPrev && !hasNext) {
        controls.style.display = 'none';
        return;
    }

    controls.style.display = 'flex';
    prevBtn.disabled = !hasPrev;
    nextBtn.disabled = !hasNext;
}

function renderFallbackState() {
    const updateList = document.getElementById('updateList');
    const popularList = document.getElementById('popularList');

    if (updateList) {
        updateList.innerHTML = `
            <div class="loading">
                <p>Tidak dapat memuat update terbaru.</p>
            </div>
        `;
    }

    if (popularList && appState.popular.length === 0) {
        popularList.innerHTML = `
            <div class="loading">
                <p>Tidak dapat memuat daftar populer.</p>
            </div>
        `;
    }
}

function setupPaginationControls() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (appState.isLoading) return;
            const targetPage = Math.max(1, appState.page - 1);
            if (targetPage !== appState.page) {
                loadHomePage(targetPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (appState.isLoading) return;
            const targetPage = appState.page + 1;
            loadHomePage(targetPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
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
            case 'v7':
                window.location.href = '/v7/home';
                break;
            default:
                window.location.href = '/';
        }
    });
}

function setupSearchHandler() {
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchAnime);
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                searchAnime();
            }
        });
    }
}

function normalizeDetailSlug(slug = '') {
    if (!slug) return '';
    return slug.startsWith('anime/') ? slug : `anime/${slug}`;
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;

    errorContainer.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
    errorContainer.style.display = 'block';
    appState.error = message;
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;

    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    appState.error = null;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
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

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (!query) return;

    window.location.href = `/v6/search?q=${encodeURIComponent(query)}`;
}

console.log('[V6] AnimeIndo home initialized');
