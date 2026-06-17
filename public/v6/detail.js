// AnimMe V6 - AnimeIndo Detail Page
const API_BASE = '/api/v6/animeindo';

const detailState = {
    slug: null,
    data: null,
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    initializeDetail();
});

function initializeDetail() {
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get('slug') || params.get('s') || '';

    if (!slugParam) {
        showError('Parameter slug tidak ditemukan.');
        renderFallback();
        return;
    }

    detailState.slug = slugParam;
    loadDetailData(slugParam);
}

async function loadDetailData(slug) {
    detailState.isLoading = true;
    showLoading();
    hideError();

    try {
        const response = await fetch(`${API_BASE}/detail/${encodeSlug(slug)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Data tidak valid');
        }

        detailState.data = payload.data;
        renderDetail();
    } catch (error) {
        console.error('[V6] Detail API error:', error);
        showError('Gagal memuat detail anime.');
        renderFallback();
    } finally {
        detailState.isLoading = false;
    }
}

function renderDetail() {
    const container = document.getElementById('detailContainer');
    if (!container || !detailState.data) return;

    const anime = detailState.data;
    const poster = anime.poster || anime.poster_original || '/images/placeholder.jpg';
    const genres = Array.isArray(anime.genres) ? anime.genres : [];
    const episodes = Array.isArray(anime.episodes) ? anime.episodes : [];

    const genreHtml = genres.length
        ? genres.map(genre => `<span class="genre-chip">${escapeHtml(genre.name)}</span>`).join('')
        : '<span class="genre-chip">Genre Tidak Diketahui</span>';

    const episodesHtml = episodes.length
        ? episodes.map(ep => {
            const episodeNumber = ep.episode || 'Episode';
            const slug = encodeURIComponent(ep.slug || '');
            const link = slug ? `/v6/episode?slug=${slug}` : ep.url || '#';
            return `
                <a class="episode-card" href="${link}">
                    <span>${escapeHtml(anime.title || 'Episode')}</span>
                    <span class="episode-number">#${escapeHtml(episodeNumber)}</span>
                </a>
            `;
        }).join('')
        : '<div class="empty-state">Belum ada data episode.</div>';

    container.innerHTML = `
        <div class="detail-header">
            <div class="poster-wrapper">
                <img src="${poster}" alt="Poster ${escapeHtml(anime.title || '')}">
            </div>
            <div class="detail-info">
                <h1 class="detail-title">${escapeHtml(anime.title || 'Detail Anime')}</h1>
                <div class="genre-list">
                    ${genreHtml}
                </div>
                <p class="synopsis">${escapeHtml(anime.synopsis || 'Sinopsis tidak tersedia.')}</p>
            </div>
        </div>

        <div class="section-divider"></div>

        <section>
            <h2 class="section-title">Daftar Episode</h2>
            <div class="episodes-grid">
                ${episodesHtml}
            </div>
        </section>
    `;
}

function renderFallback() {
    const container = document.getElementById('detailContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state">
            Data detail tidak dapat ditampilkan saat ini.
        </div>
    `;
}

function showLoading() {
    const container = document.getElementById('detailContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Memuat detail anime...</p>
        </div>
    `;
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
    errorContainer.style.display = 'block';
    detailState.error = message;
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    detailState.error = null;
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

console.log('[V6] AnimeIndo detail page initialized');
