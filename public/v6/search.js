// AnimMe V6 - AnimeIndo Search Page
const API_BASE = '/api/v6/animeindo';

const searchState = {
    keyword: '',
    results: [],
    headline: '',
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    initializeSearchPage();
});

function initializeSearchPage() {
    const params = new URLSearchParams(window.location.search);
    const keyword = params.get('q') || params.get('keyword') || '';

    if (!keyword.trim()) {
        showError('Masukkan kata kunci pencarian.');
        renderFallback('Silakan isi kata kunci di kotak pencarian di atas.');
        return;
    }

    searchState.keyword = keyword.trim();
    updateHeadings();
    loadSearchResults(searchState.keyword);
}

async function loadSearchResults(keyword) {
    searchState.isLoading = true;
    showLoading();
    hideError();

    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(keyword)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Data pencarian tidak valid');
        }

        const data = payload.data;
        searchState.keyword = data.keyword || keyword;
        searchState.headline = data.headline || '';
        searchState.results = Array.isArray(data.results) ? data.results : [];

        updateHeadings();
        renderResults();
    } catch (error) {
        console.error('[V6] Search API error:', error);
        showError('Gagal memuat hasil pencarian.');
        renderFallback('Tidak dapat menampilkan hasil pencarian.');
    } finally {
        searchState.isLoading = false;
    }
}

function renderResults() {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;

    if (!searchState.results.length) {
        renderFallback('Tidak ditemukan anime yang cocok dengan pencarian Anda.');
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'result-grid';

    searchState.results.forEach((item) => {
        const poster = item.poster || item.poster_original || '/images/placeholder.jpg';
        const title = escapeHtml(item.title || 'Anime');
        const description = escapeHtml(item.description || 'Deskripsi tidak tersedia.');
        const labels = (item.labels || []).map(label => `<span class="result-label">${escapeHtml(label)}</span>`).join('');

        const linkInfo = buildResultLink(item);
        const linkAttrs = linkInfo.isInternal
            ? `href="${linkInfo.url}"`
            : `href="${linkInfo.url}" target="_blank" rel="noopener"`;

        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <div class="result-poster" style="background-image:url('${poster}')"></div>
            <div class="result-info">
                <a class="result-title" ${linkAttrs}>${title}</a>
                <div class="result-labels">${labels}</div>
                <div class="result-description">${description}</div>
            </div>
        `;

        grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

function buildResultLink(item) {
    const slug = item.slug || '';
    const fallback = item.url || '#';

    if (!slug) {
        return { url: fallback, isInternal: false };
    }

    const normalizedSlug = slug.startsWith('anime/') ? slug : slug;

    if (normalizedSlug.includes('episode')) {
        return {
            url: `/v6/episode?slug=${encodeURIComponent(normalizedSlug)}`,
            isInternal: true
        };
    }

    const detailSlug = normalizedSlug.startsWith('anime/')
        ? normalizedSlug
        : `anime/${normalizedSlug}`;

    return {
        url: `/v6/detail?slug=${encodeURIComponent(detailSlug)}`,
        isInternal: true
    };
}

function renderFallback(message) {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="error" style="background:rgba(52,152,219,0.12);color:rgba(226,239,255,0.75);border-radius:10px;">
            ${escapeHtml(message)}
        </div>
    `;
}

function showLoading() {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Memuat hasil pencarian...</p>
        </div>
    `;
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
    errorContainer.style.display = 'block';
    searchState.error = message;
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    searchState.error = null;
}

function updateHeadings() {
    const titleEl = document.getElementById('searchTitle');
    const subtitleEl = document.getElementById('searchSubtitle');
    const topbarTitle = document.getElementById('topbarTitle');
    const keyword = searchState.keyword || 'Anime';

    if (titleEl) titleEl.textContent = `Hasil Pencarian: ${keyword}`;
    if (subtitleEl) subtitleEl.textContent = searchState.headline
        ? searchState.headline
        : `Menampilkan hasil pencarian untuk "${keyword}".`;
    if (topbarTitle) topbarTitle.textContent = `AnimMe V6 - Pencarian ${keyword}`;
    document.title = `AnimMe V6 - Cari "${keyword}"`;
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
    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

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
        searchBtn.addEventListener('click', () => {
            const query = searchInput ? searchInput.value.trim() : '';
            if (!query) return;
            redirectToSearch(query);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const query = searchInput.value.trim();
                if (!query) return;
                redirectToSearch(query);
            }
        });
    }
}

function redirectToSearch(query) {
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

console.log('[V6] AnimeIndo search page initialized');
