// AnimMe V7 - Nekopoi Search Application
const API_BASE = '/api/v7/nekopoi';

const appState = {
    query: '',
    page: 1,
    results: [],
    pagination: {
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false
    },
    isLoading: false
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    setupPaginationControls();
});

async function initializeApp() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q') || params.get('query') || '';
    const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = query;

    if (!query.trim()) {
        renderEmptyPrompt();
        return;
    }

    await loadSearch(query.trim(), page);
}

async function loadSearch(query, page = 1) {
    appState.isLoading = true;
    appState.query = query;
    appState.page = page;
    renderLoading();
    updateHero(query, page);

    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&page=${page}`);
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || `HTTP ${response.status}`);
        }

        const { results, currentPage, totalPages, hasNextPage, hasPrevPage } = payload.data;
        appState.results = Array.isArray(results) ? results : [];
        appState.pagination = {
            currentPage: currentPage || page,
            totalPages: totalPages || currentPage || page,
            hasNextPage: Boolean(hasNextPage),
            hasPrevPage: Boolean(hasPrevPage)
        };
        renderResults();
        renderPagination();
        syncUrl(query, appState.pagination.currentPage);
    } catch (error) {
        console.error('[V7] Search API error:', error);
        const isBlocked = /SafeLine|Chaitin|anti-bot|HTTP 468/i.test(error.message || '');
        renderError(isBlocked
            ? 'Nekopoi sedang memblokir request dengan SafeLine/Chaitin anti-bot. Coba lagi nanti.'
            : 'Gagal memuat hasil pencarian Nekopoi.');
    } finally {
        appState.isLoading = false;
    }
}

function updateHero(query, page) {
    const title = document.getElementById('searchTitle');
    const subtitle = document.getElementById('searchSubtitle');
    if (title) title.textContent = `Hasil untuk “${query}”`;
    if (subtitle) subtitle.textContent = `Menampilkan hasil pencarian Nekopoi halaman ${page}.`;
}

function renderLoading() {
    const content = document.getElementById('searchContent');
    if (!content) return;
    content.className = 'search-loading';
    content.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Memuat hasil pencarian...</p>
    `;
}

function renderEmptyPrompt() {
    const content = document.getElementById('searchContent');
    const title = document.getElementById('searchTitle');
    const subtitle = document.getElementById('searchSubtitle');
    if (title) title.textContent = 'Search Nekopoi';
    if (subtitle) subtitle.textContent = 'Masukkan kata kunci di kolom pencarian untuk mulai mencari.';
    if (!content) return;
    content.className = 'search-empty';
    content.innerHTML = `
        <h2>🔎 Masukkan kata kunci</h2>
        <p>Contoh: episode, uncensored, judul seri, atau nama karakter.</p>
    `;
    hidePagination();
}

function renderResults() {
    const content = document.getElementById('searchContent');
    if (!content) return;

    if (!appState.results.length) {
        content.className = 'search-empty';
        content.innerHTML = `
            <h2>Tidak ada hasil</h2>
            <p>Tidak ditemukan hasil untuk “${escapeHtml(appState.query)}”.</p>
        `;
        return;
    }

    content.className = 'result-grid';
    content.replaceChildren();
    appState.results.forEach((item) => {
        content.appendChild(createResultCard(item));
    });
}

function createResultCard(item) {
    const card = document.createElement('a');
    card.className = 'result-card';
    card.href = item.slug ? `/v7/episode?slug=${encodeURIComponent(item.slug)}` : (item.url || '#');
    if (!item.slug && item.url) {
        card.target = '_blank';
        card.rel = 'noopener';
    }

    const poster = item.poster || '/images/placeholder.jpg';
    const title = item.title || 'Judul tidak tersedia';
    const excerpt = item.excerpt || '';

    card.innerHTML = `
        <div class="result-poster" style="background-image:url('${escapeAttribute(poster)}')">
            <span class="result-badge">Result</span>
        </div>
        <div class="result-info">
            <div class="result-title">${escapeHtml(title)}</div>
            ${excerpt ? `<div class="result-desc">${escapeHtml(excerpt)}</div>` : ''}
        </div>
    `;

    return card;
}

function renderError(message) {
    const content = document.getElementById('searchContent');
    if (!content) return;
    content.className = 'search-error';
    content.innerHTML = `
        <h2>Gagal memuat</h2>
        <p>${escapeHtml(message)}</p>
        <button class="search-btn" type="button" onclick="loadSearch(appState.query, appState.page)">Coba Lagi</button>
    `;
    hidePagination();
}

function setupPaginationControls() {
    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (!appState.isLoading && appState.pagination.hasPrevPage) {
            loadSearch(appState.query, Math.max(1, appState.pagination.currentPage - 1));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        if (!appState.isLoading && appState.pagination.hasNextPage) {
            loadSearch(appState.query, appState.pagination.currentPage + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('pageJumpForm')?.addEventListener('submit', (event) => {
        event.preventDefault();
        if (appState.isLoading) return;
        const maxPage = appState.pagination.totalPages || 1000;
        const input = document.getElementById('pageJumpInput');
        const page = Math.max(1, Math.min(maxPage, parseInt(input?.value, 10) || 1));
        loadSearch(appState.query, page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function renderPagination() {
    const controls = document.getElementById('paginationControls');
    const prev = document.getElementById('prevPageBtn');
    const next = document.getElementById('nextPageBtn');
    const info = document.getElementById('pageInfo');
    const jumpInput = document.getElementById('pageJumpInput');
    if (!controls || !prev || !next || !info) return;

    const { currentPage, totalPages } = appState.pagination;

    controls.style.display = 'flex';
    prev.disabled = !appState.pagination.hasPrevPage;
    next.disabled = !appState.pagination.hasNextPage;
    info.textContent = `Halaman ${currentPage}${totalPages ? ` dari ${totalPages}` : ''}`;

    if (jumpInput) {
        jumpInput.value = currentPage;
        jumpInput.max = totalPages || '';
        jumpInput.placeholder = totalPages ? `1-${totalPages}` : '15';
    }
}

function hidePagination() {
    const controls = document.getElementById('paginationControls');
    if (controls) controls.style.display = 'none';
}

function setupSearchHandler() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    const performSearch = () => {
        const query = searchInput?.value?.trim();
        if (query) {
            loadSearch(query, 1);
        }
    };

    searchBtn?.addEventListener('click', performSearch);
    searchInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') performSearch();
    });
}

function setupServerSelector() {
    const serverSelect = document.getElementById('serverSelect');
    if (!serverSelect) return;

    serverSelect.addEventListener('change', (e) => {
        const versionMap = {
            v1: '/v1/home',
            v2: '/v2/home',
            v3: '/v3/home',
            v4: '/v4/home',
            v5: '/v5/home',
            v6: '/v6/home',
            v7: '/v7/home',
            v8: '/v8/home',
            v9: '/v9/home',
            v10: '/v10/home'
        };
        const targetPath = versionMap[e.target.value];
        if (targetPath) window.location.href = targetPath;
    });
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const sidebarLinks = document.querySelectorAll('.sidebar-menu .nav-link');

    const openSidebar = () => {
        sidebar?.classList.add('active');
        backdrop?.classList.add('active');
        document.body.classList.add('sidebar-open');
    };
    const closeSidebar = () => {
        sidebar?.classList.remove('active');
        backdrop?.classList.remove('active');
        document.body.classList.remove('sidebar-open');
    };

    menuToggle?.addEventListener('click', openSidebar);
    menuCloseBtn?.addEventListener('click', closeSidebar);
    backdrop?.addEventListener('click', closeSidebar);
    sidebarLinks.forEach(link => {
        link.addEventListener('click', closeSidebar);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        }
    });
}

function initMobileSearch() {
    const searchContainer = document.querySelector('.search-container');
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchInput = document.getElementById('searchInput');

    searchIconBtn?.addEventListener('click', () => {
        searchContainer?.classList.add('active');
        setTimeout(() => searchInput?.focus(), 100);
    });

    searchCloseBtn?.addEventListener('click', () => {
        searchContainer?.classList.remove('active');
        if (searchInput) searchInput.value = '';
    });
}

function syncUrl(query, page) {
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    if (page > 1) url.searchParams.set('page', String(page));
    else url.searchParams.delete('page');
    window.history.replaceState({}, '', url);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function escapeAttribute(text) {
    return escapeHtml(text).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
