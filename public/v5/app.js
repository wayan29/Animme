// AnimMe V5 - Anoboy Application
const API_BASE = '/api/v5/anoboy';

// State management
let appState = {
    latestReleases: [],
    ongoingAnime: [],
    pagination: {},
    isLoading: false,
    error: null
};

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[V5] Initializing Anoboy application...');
    initializeApp();
    initSidebarToggle();
    initMobileSearch();
});

// Initialize application
async function initializeApp() {
    try {
        appState.isLoading = true;

        // Load homepage data
        console.log('[V5] Fetching homepage data...');
        const homepageData = await fetchAPI('/home');

        if (homepageData && homepageData.status === 'success' && homepageData.data) {
            const { latest_releases, ongoing_anime, pagination } = homepageData.data;

            appState.latestReleases = latest_releases || [];
            appState.ongoingAnime = ongoing_anime || [];
            appState.pagination = pagination || {};

            console.log('[V5] Data loaded:', {
                latest: appState.latestReleases.length,
                ongoing: appState.ongoingAnime.length
            });

            // Render sections
            renderLatestReleases();
            renderOngoingAnime();
        } else {
            showError('Gagal memuat data homepage');
        }

        // Setup server selector
        setupServerSelector();

    } catch (error) {
        console.error('[V5] Error initializing app:', error);
        showError('Terjadi kesalahan saat memuat data');
    } finally {
        appState.isLoading = false;
    }
}

// Fetch data from API
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`[V5] API Error (${endpoint}):`, error);
        throw error;
    }
}

// Render latest releases section
function renderLatestReleases() {
    const section = document.getElementById('latestSection');
    const container = document.getElementById('latestReleases');
    const countBadge = document.getElementById('latestCount');

    if (!appState.latestReleases || appState.latestReleases.length === 0) {
        container.innerHTML = '<p class="loading">Tidak ada anime terbaru tersedia</p>';
        return;
    }

    section.style.display = 'block';
    countBadge.textContent = appState.latestReleases.length;

    // Clear loading state
    container.innerHTML = '';

    appState.latestReleases.forEach(anime => {
        const card = createAnimeCard(anime);
        container.appendChild(card);
    });
}

// Render ongoing anime section
function renderOngoingAnime() {
    const section = document.getElementById('ongoingSection');
    const container = document.getElementById('ongoingAnime');
    const countBadge = document.getElementById('ongoingCount');

    if (!appState.ongoingAnime || appState.ongoingAnime.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    countBadge.textContent = appState.ongoingAnime.length;

    // Clear loading state
    container.innerHTML = '';

    appState.ongoingAnime.forEach(anime => {
        const card = createAnimeCard(anime);
        container.appendChild(card);
    });
}

// Create anime card element
function createAnimeCard(anime) {
    const link = document.createElement('a');
    link.className = 'anime-card';

    // Determine link destination: if has episode field, it's an episode; otherwise it's anime detail
    if (anime.slug) {
        if (anime.episode) {
            // Latest release episode - link to episode page
            link.href = `/v5/episode?slug=${encodeURIComponent(anime.slug)}`;
        } else {
            // Recommendation or anime - link to detail page
            link.href = `/v5/detail?slug=${encodeURIComponent(anime.slug)}`;
        }
    } else {
        link.href = '#';
    }

    link.style.textDecoration = 'none';
    link.style.color = 'inherit';

    const poster = anime.poster || '/images/placeholder.jpg';
    const episode = anime.episode ? `<span class="anime-episode">${anime.episode}</span>` : '';
    const type = anime.type ? `<span class="anime-type">${anime.type}</span>` : '';

    link.innerHTML = `
        <div class="anime-poster" style="background-image: url('${poster}');"></div>
        <div class="anime-info">
            <div class="anime-title">${escapeHtml(anime.title)}</div>
            <div class="anime-meta">
                ${episode}
                ${type}
            </div>
        </div>
    `;

    return link;
}

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `<div class="error">⚠️ ${message}</div>`;
    errorContainer.style.display = 'block';
    appState.error = message;
}

// Hide error message
function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.style.display = 'none';
    appState.error = null;
}

// Setup server selector dropdown
function setupServerSelector() {
    const selector = document.getElementById('serverSelect');

    selector.addEventListener('change', (e) => {
        const version = e.target.value;
        switch(version) {
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
        }
    });
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Initialize sidebar toggle
function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!menuToggle || !sidebar) return;

    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
        document.body.classList.add('sidebar-open');
    });

    const closeSidebar = () => {
        sidebar.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';
    };

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', closeSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
}

// Initialize mobile search
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

    // Search on enter key
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAnime();
            }
        });
    }
}

// Search anime functionality
function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (query) {
        window.location.href = `/v5/search?q=${encodeURIComponent(query)}`;
    }
}

// Log app initialization
console.log('[V5] Anoboy V5 app loaded');
