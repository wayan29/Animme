// AnimMe V7 - Nekopoi Home Application
const API_BASE = '/api/v7/nekopoi';

const appState = {
    page: 1,
    episodes: [],
    pagination: {
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
        totalPagesFetched: 2
    },
    isLoading: false,
    error: null,
    isUpstreamBlocked: false
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
        console.error('[V7] Failed to initialize home:', error);
        showError('Terjadi kesalahan saat memuat data dari Nekopoi.');
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

        appState.isUpstreamBlocked = false;
        const { episodes, currentPage, hasNextPage, hasPrevPage, totalPagesFetched } = payload.data;

        appState.episodes = Array.isArray(episodes) ? episodes : [];
        appState.pagination = {
            currentPage: currentPage || page,
            hasNextPage: hasNextPage || false,
            hasPrevPage: hasPrevPage || false,
            totalPagesFetched: totalPagesFetched || 2
        };

        renderEpisodes();
        renderPagination();
    } catch (error) {
        console.error('[V7] Home API error:', error);
        const isBlocked = /SafeLine|Chaitin|anti-bot|HTTP 468/i.test(error.message || '');
        appState.isUpstreamBlocked = isBlocked;
        showError(isBlocked
            ? 'Nekopoi sedang memblokir request dari server ini dengan SafeLine/Chaitin anti-bot (HTTP 468).'
            : 'Gagal memuat data homepage Nekopoi.');
        renderFallbackState();
    } finally {
        appState.isLoading = false;
    }
}

function showLoadingState() {
    const episodeList = document.getElementById('episodeList');

    if (episodeList) {
        episodeList.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat episode terbaru dari Nekopoi...</p>
            </div>
        `;
    }
}

function renderEpisodes() {
    const container = document.getElementById('episodeList');
    const countBadge = document.getElementById('episodeCount');

    if (!container) return;

    if (!appState.episodes.length) {
        container.innerHTML = `
            <div class="loading">
                <p>Tidak ada episode yang tersedia.</p>
            </div>
        `;
        if (countBadge) countBadge.textContent = '0';
        return;
    }

    container.innerHTML = '';
    appState.episodes.forEach((item) => {
        const poster = item.poster || '/images/placeholder.jpg';
        const title = escapeHtml(item.title || 'Judul tidak tersedia');
        const episode = item.episode ? escapeHtml(String(item.episode)) : '';
        const date = item.date ? escapeHtml(item.date) : '';

        const card = document.createElement('a');
        card.className = 'episode-card';

        const slug = item.slug || '';
        if (slug) {
            card.href = `/v7/episode?slug=${encodeURIComponent(slug)}`;
        } else if (item.url) {
            card.href = item.url;
            card.target = '_blank';
            card.rel = 'noopener';
        } else {
            card.href = '#';
        }

        card.innerHTML = `
            <div class="episode-poster" style="background-image: url('${poster}');">
                ${episode ? `<span class="episode-badge">${episode}</span>` : ''}
                ${date ? `<span class="episode-date">${date}</span>` : ''}
            </div>
            <div class="episode-info">
                <div class="episode-title">${title}</div>
            </div>
        `;

        container.appendChild(card);
    });

    if (countBadge) countBadge.textContent = String(appState.episodes.length);
}

function renderPagination() {
    const paginationControls = document.getElementById('paginationControls');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');

    if (!paginationControls || !prevBtn || !nextBtn) return;

    const { currentPage, hasPrevPage, hasNextPage, totalPagesFetched } = appState.pagination;

    paginationControls.style.display = 'flex';
    prevBtn.disabled = !hasPrevPage;
    nextBtn.disabled = !hasNextPage;

    if (pageInfo) {
        const startPage = (currentPage - 1) * totalPagesFetched + 1;
        const endPage = currentPage * totalPagesFetched;
        pageInfo.textContent = `Halaman ${startPage}-${endPage}`;
    }
}

function renderFallbackState() {
    const container = document.getElementById('episodeList');
    if (container) {
        container.innerHTML = appState.isUpstreamBlocked
            ? `
                <div class="loading">
                    <p>Nekopoi sedang mengaktifkan verifikasi anti-bot, jadi data belum bisa diambil otomatis saat ini.</p>
                    <p>Coba lagi nanti saat proteksinya longgar atau ganti ke server lain.</p>
                </div>
            `
            : `
                <div class="loading">
                    <p>Gagal memuat data. Silakan coba lagi nanti.</p>
                </div>
            `;
    }
}

function setupPaginationControls() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (appState.pagination.hasPrevPage && !appState.isLoading) {
                // Go back by 2 pages (since we fetch 2 at a time)
                const newPage = Math.max(1, appState.page - 1);
                loadHomePage(newPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (appState.pagination.hasNextPage && !appState.isLoading) {
                // Go forward by 2 pages (since we fetch 2 at a time)
                loadHomePage(appState.page + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
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

    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
}

function setupServerSelector() {
    const serverSelect = document.getElementById('serverSelect');
    if (!serverSelect) return;

    serverSelect.addEventListener('change', (e) => {
        const selectedVersion = e.target.value;
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

        const targetPath = versionMap[selectedVersion];
        if (targetPath) {
            window.location.href = targetPath;
        }
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
    };

    const closeSidebar = () => {
        sidebar?.classList.remove('active');
        backdrop?.classList.remove('active');
    };

    menuToggle?.addEventListener('click', openSidebar);
    menuCloseBtn?.addEventListener('click', closeSidebar);
    backdrop?.addEventListener('click', closeSidebar);

    // Close sidebar when clicking nav links
    sidebarLinks.forEach(link => {
        link.addEventListener('click', closeSidebar);
    });
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchContainer = document.querySelector('.search-container');

    searchIconBtn?.addEventListener('click', () => {
        searchContainer?.classList.add('active');
        document.getElementById('searchInput')?.focus();
    });

    searchCloseBtn?.addEventListener('click', () => {
        searchContainer?.classList.remove('active');
    });
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
        errorContainer.style.display = 'block';
    }
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.style.display = 'none';
        errorContainer.innerHTML = '';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
