// AnimMe V7 - Nekopoi Category Application
const API_BASE = '/api/v7/nekopoi';

const CATEGORY_META = {
    hentai: { label: 'Hentai', icon: '🔥', desc: 'Update kategori hentai dari Nekopoi.' },
    '2d-animation': { label: '2D Animation', icon: '🎞️', desc: 'Koleksi 2D animation dari Nekopoi.' },
    '3d-hentai': { label: '3D Hentai', icon: '🧊', desc: 'Koleksi 3D hentai dari Nekopoi.' },
    jav: { label: 'JAV', icon: '🎥', desc: 'Update kategori JAV dari Nekopoi.' },
    'jav-cosplay': { label: 'JAV Cosplay', icon: '👘', desc: 'Update JAV Cosplay dari Nekopoi.' }
};

const appState = {
    slug: '',
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
    const slug = String(params.get('slug') || 'hentai').trim().toLowerCase();
    const page = Math.max(1, parseInt(params.get('page'), 10) || 1);

    if (!CATEGORY_META[slug]) {
        renderError('Kategori tidak valid. Pilih kategori dari menu V7.');
        return;
    }

    await loadCategory(slug, page);
}

async function loadCategory(slug, page = 1) {
    appState.isLoading = true;
    appState.slug = slug;
    appState.page = page;
    renderLoading();
    updateHero(slug, page);
    syncActiveMenu(slug);

    try {
        const response = await fetch(`${API_BASE}/category/${encodeURIComponent(slug)}?page=${page}`);
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || `HTTP ${response.status}`);
        }

        const { items, currentPage, hasNextPage, hasPrevPage } = payload.data;
        appState.results = Array.isArray(items) ? items : [];
        appState.pagination = {
            currentPage: currentPage || page,
            hasNextPage: Boolean(hasNextPage),
            hasPrevPage: Boolean(hasPrevPage)
        };
        renderResults();
        renderPagination();
        syncUrl(slug, appState.pagination.currentPage);
    } catch (error) {
        console.error('[V7] Category API error:', error);
        const isBlocked = /SafeLine|Chaitin|anti-bot|HTTP 468/i.test(error.message || '');
        renderError(isBlocked
            ? 'Nekopoi sedang memblokir request dengan SafeLine/Chaitin anti-bot. Coba lagi nanti.'
            : 'Gagal memuat kategori Nekopoi.');
    } finally {
        appState.isLoading = false;
    }
}

function updateHero(slug, page) {
    const meta = CATEGORY_META[slug] || CATEGORY_META.hentai;
    const title = document.getElementById('searchTitle');
    const subtitle = document.getElementById('searchSubtitle');
    const kicker = document.getElementById('categoryKicker');
    if (kicker) kicker.textContent = `V7 · Nekopoi Category · ${meta.label}`;
    if (title) title.textContent = `${meta.icon} ${meta.label}`;
    if (subtitle) subtitle.textContent = `${meta.desc} Halaman ${page}.`;
    document.title = `${meta.label} - AnimMe V7`;
}

function syncActiveMenu(slug) {
    document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.categoryLink === slug);
    });
}

function renderLoading() {
    const content = document.getElementById('searchContent');
    if (!content) return;
    content.className = 'search-loading';
    content.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Memuat kategori...</p>
    `;
}

function renderResults() {
    const content = document.getElementById('searchContent');
    if (!content) return;

    if (!appState.results.length) {
        content.className = 'search-empty';
        content.innerHTML = `
            <h2>Tidak ada item</h2>
            <p>Belum ada item untuk kategori ini.</p>
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
    const meta = CATEGORY_META[appState.slug] || CATEGORY_META.hentai;

    card.innerHTML = `
        <div class="result-poster" style="background-image:url('${escapeAttribute(poster)}')">
            <span class="result-badge">${escapeHtml(meta.label)}</span>
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
        <button class="search-btn" type="button" onclick="loadCategory(appState.slug || 'hentai', appState.page || 1)">Coba Lagi</button>
    `;
    hidePagination();
}

function setupPaginationControls() {
    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (!appState.isLoading && appState.pagination.hasPrevPage) {
            loadCategory(appState.slug, Math.max(1, appState.pagination.currentPage - 1));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        if (!appState.isLoading && appState.pagination.hasNextPage) {
            loadCategory(appState.slug, appState.pagination.currentPage + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

function renderPagination() {
    const controls = document.getElementById('paginationControls');
    const prev = document.getElementById('prevPageBtn');
    const next = document.getElementById('nextPageBtn');
    const info = document.getElementById('pageInfo');
    if (!controls || !prev || !next || !info) return;

    controls.style.display = 'flex';
    prev.disabled = !appState.pagination.hasPrevPage;
    next.disabled = !appState.pagination.hasNextPage;
    const meta = CATEGORY_META[appState.slug] || CATEGORY_META.hentai;
    info.textContent = `${meta.label} · Halaman ${appState.pagination.currentPage}`;
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
            window.location.href = `/v7/search?q=${encodeURIComponent(query)}`;
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
        if (event.key === 'Escape') {
            closeSidebar();
        }
    });
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchContainer = document.querySelector('.search-container');
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

function syncUrl(slug, page) {
    const params = new URLSearchParams();
    params.set('slug', slug);
    if (page > 1) params.set('page', page);
    const newUrl = `/v7/category?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function escapeAttribute(text) {
    return escapeHtml(text).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
