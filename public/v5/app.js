// AnimMe V5 - Anoboy Application
const API_BASE = '/api/v5/anoboy';
const GRID_DISPLAY_LIMIT = 20;

const appState = {
    latestReleases: [],
    recommendations: [],
    ongoingAnime: [],
    pagination: {},
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('[V5] Initializing Anoboy application...');
    initializeApp();
    initSidebarToggle();
    initMobileSearch();
});

async function initializeApp() {
    try {
        appState.isLoading = true;

        console.log('[V5] Fetching homepage data...');
        const [homepageData, ongoingData] = await Promise.all([
            fetchAPI('/home'),
            fetchAPI('/ongoing').catch((error) => {
                console.warn('[V5] Ongoing fetch failed:', error.message);
                return null;
            })
        ]);

        if (homepageData && homepageData.status === 'success' && homepageData.data) {
            const { latest_releases, recommendations, pagination } = homepageData.data;

            appState.latestReleases = latest_releases || [];
            appState.recommendations = recommendations || [];
            appState.pagination = pagination || {};

            if (ongoingData && ongoingData.status === 'success') {
                appState.ongoingAnime = Array.isArray(ongoingData.data) ? ongoingData.data : [];
            }

            console.log('[V5] Data loaded:', {
                latest: appState.latestReleases.length,
                recommendations: appState.recommendations.length,
                ongoing: appState.ongoingAnime.length
            });

            renderLatestReleases();
            renderRecommendations();
            renderOngoingAnime();
        } else {
            showError('Gagal memuat data homepage');
        }

        setupServerSelector();
    } catch (error) {
        console.error('[V5] Error initializing app:', error);
        showError('Terjadi kesalahan saat memuat data');
    } finally {
        appState.isLoading = false;
    }
}

async function fetchAPI(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

function formatSectionCount(total, displayed) {
    if (total > displayed) {
        return `${displayed}/${total}`;
    }
    return String(total);
}

function renderAnimeGridSection({
    sectionId,
    containerId,
    countId,
    moreId,
    items,
    emptyMessage,
    moreHref = null,
    showMoreWhenTruncated = true
}) {
    const section = document.getElementById(sectionId);
    const container = document.getElementById(containerId);
    const countBadge = document.getElementById(countId);
    const moreLink = moreId ? document.getElementById(moreId) : null;

    if (!section || !container) return;

    if (!items || items.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    const displayedItems = items.slice(0, GRID_DISPLAY_LIMIT);
    const isTruncated = items.length > GRID_DISPLAY_LIMIT;

    if (countBadge) {
        countBadge.textContent = formatSectionCount(items.length, displayedItems.length);
    }

    container.replaceChildren();
    displayedItems.forEach((anime) => {
        container.appendChild(createAnimeCard(anime));
    });

    if (moreLink) {
        const shouldShowMore = showMoreWhenTruncated && (isTruncated || appState.pagination?.has_next_page);
        moreLink.classList.toggle('hidden', !shouldShowMore || !moreHref);
        if (moreHref) {
            moreLink.href = moreHref;
        }
    }
}

function renderLatestReleases() {
    renderAnimeGridSection({
        sectionId: 'latestSection',
        containerId: 'latestReleases',
        countId: 'latestCount',
        moreId: 'latestMore',
        items: appState.latestReleases,
        emptyMessage: 'Tidak ada anime terbaru tersedia',
        moreHref: '/v5/latest'
    });
}

function renderRecommendations() {
    renderAnimeGridSection({
        sectionId: 'recommendationSection',
        containerId: 'recommendationAnime',
        countId: 'recommendationCount',
        moreId: null,
        items: appState.recommendations,
        emptyMessage: 'Tidak ada rekomendasi tersedia',
        showMoreWhenTruncated: false
    });
}

function renderOngoingAnime() {
    renderAnimeGridSection({
        sectionId: 'ongoingSection',
        containerId: 'ongoingAnime',
        countId: 'ongoingCount',
        moreId: null,
        items: appState.ongoingAnime,
        emptyMessage: 'Tidak ada anime ongoing tersedia',
        showMoreWhenTruncated: false
    });
}

function createAnimeCard(anime) {
    const link = document.createElement('a');
    link.className = 'anime-card';

    if (anime.slug) {
        link.href = anime.episode
            ? `/v5/episode?slug=${encodeURIComponent(anime.slug)}`
            : `/v5/detail?slug=${encodeURIComponent(anime.slug)}`;
    } else {
        link.href = '#';
    }

    const posterEl = document.createElement('div');
    posterEl.className = 'anime-poster';
    if (anime.poster) {
        posterEl.style.backgroundImage = `url('${anime.poster.replace(/'/g, '%27')}')`;
    }

    const info = document.createElement('div');
    info.className = 'anime-info';

    const title = document.createElement('div');
    title.className = 'anime-title';
    title.textContent = anime.title || 'Tanpa judul';

    const meta = document.createElement('div');
    meta.className = 'anime-meta';

    if (anime.episode) {
        const episode = document.createElement('span');
        episode.className = 'anime-episode';
        episode.textContent = anime.episode;
        meta.appendChild(episode);
    }

    if (anime.type) {
        const type = document.createElement('span');
        type.className = 'anime-type';
        type.textContent = anime.type;
        meta.appendChild(type);
    }

    if (anime.score) {
        const score = document.createElement('span');
        score.className = 'anime-type';
        score.textContent = anime.score;
        meta.appendChild(score);
    }

    info.appendChild(title);
    info.appendChild(meta);
    link.appendChild(posterEl);
    link.appendChild(info);

    return link;
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.replaceChildren();
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = `⚠️ ${message}`;
    errorContainer.appendChild(error);
    errorContainer.style.display = 'block';
    appState.error = message;
}

function setupServerSelector() {
    const selector = document.getElementById('serverSelect');
    if (!selector) return;

    selector.addEventListener('change', (e) => {
        const version = e.target.value;
        const routes = {
            v1: '/v1/home',
            v2: '/v2/home',
            v3: '/v3/home',
            v4: '/v4/home',
            v5: '/v5/home',
            v6: '/v6/home'
        };
        if (routes[version]) {
            window.location.href = routes[version];
        }
    });
}

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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
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

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAnime();
            }
        });
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (query) {
        window.location.href = `/v5/search?q=${encodeURIComponent(query)}`;
    }
}

console.log('[V5] Anoboy V5 app loaded');