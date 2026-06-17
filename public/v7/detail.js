// AnimMe V7 - Nekopoi Detail Application
const API_BASE = '/api/v7/nekopoi';

const appState = {
    animeData: null,
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
});

async function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
        showError('Slug anime tidak ditemukan di URL.');
        renderFallbackState();
        return;
    }

    try {
        await loadAnimeDetail(slug);
    } catch (error) {
        console.error('[V7] Failed to initialize detail:', error);
        showError('Terjadi kesalahan saat memuat detail anime.');
    }
}

async function loadAnimeDetail(slug) {
    appState.isLoading = true;
    hideError();
    showLoadingState();

    try {
        const response = await fetch(`${API_BASE}/detail/${encodeURIComponent(slug)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Respon dari server tidak valid');
        }

        appState.animeData = payload.data;
        renderAnimeDetail();
    } catch (error) {
        console.error('[V7] Detail API error:', error);
        showError('Gagal memuat detail anime dari Nekopoi.');
        renderFallbackState();
    } finally {
        appState.isLoading = false;
    }
}

function showLoadingState() {
    const content = document.getElementById('detailContent');
    if (content) {
        content.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat detail anime...</p>
            </div>
        `;
    }
}

function renderAnimeDetail() {
    const container = document.getElementById('detailContent');
    if (!container || !appState.animeData) return;

    const {
        title,
        poster,
        synopsis,
        info,
        genres,
        latestEpisode,
        episodes,
        totalEpisodes
    } = appState.animeData;

    // Update page title
    document.title = `${title} - AnimMe V7`;

    container.innerHTML = '';

    // Detail Container
    const detailDiv = document.createElement('div');
    detailDiv.className = 'detail-container';
    detailDiv.innerHTML = `
        <div class="detail-poster">
            <img src="${poster || '/images/placeholder.jpg'}" alt="${escapeHtml(title)}">
        </div>
        <div class="detail-info">
            <h1 class="anime-title">${escapeHtml(title)}</h1>
            ${renderInfoGrid(info)}
            ${genres && genres.length > 0 ? renderGenres(genres) : ''}
        </div>
    `;
    container.appendChild(detailDiv);

    // Synopsis
    if (synopsis) {
        const synopsisDiv = document.createElement('div');
        synopsisDiv.className = 'synopsis';
        synopsisDiv.innerHTML = `
            <h3>📖 Sinopsis</h3>
            <p>${escapeHtml(synopsis)}</p>
        `;
        container.appendChild(synopsisDiv);
    }

    // Latest Episode
    if (latestEpisode && latestEpisode.episode && latestEpisode.url) {
        const latestDiv = document.createElement('div');
        latestDiv.className = 'latest-episode-card';
        latestDiv.innerHTML = `
            <h3>🔥 Episode Terbaru: ${escapeHtml(latestEpisode.episode)}</h3>
            <a href="/v7/episode?slug=${extractSlug(latestEpisode.url)}" class="latest-episode-link">
                ▶️ Tonton Sekarang
            </a>
        `;
        container.appendChild(latestDiv);
    }

    // Episodes List
    if (episodes && episodes.length > 0) {
        const episodesSection = document.createElement('div');
        episodesSection.innerHTML = `
            <h2 class="section-title">📺 Daftar Episode (${totalEpisodes})</h2>
            <div class="episodes-grid" id="episodesGrid"></div>
        `;
        container.appendChild(episodesSection);

        const episodesGrid = document.getElementById('episodesGrid');
        episodes.forEach(episode => {
            const episodeCard = document.createElement('a');
            episodeCard.className = 'episode-item';
            episodeCard.href = `/v7/episode?slug=${encodeURIComponent(episode.slug)}`;
            episodeCard.innerHTML = `
                <div class="episode-number">${escapeHtml(episode.title)}</div>
                <div class="episode-date">📅 ${escapeHtml(episode.releaseDate || 'N/A')}</div>
            `;
            episodesGrid.appendChild(episodeCard);
        });
    }
}

function renderInfoGrid(info) {
    if (!info || Object.keys(info).length === 0) return '';

    let html = '<div class="info-grid">';
    for (const [key, value] of Object.entries(info)) {
        if (value && value.trim()) {
            html += `
                <div class="info-label">${escapeHtml(key)}:</div>
                <div class="info-value">${escapeHtml(value)}</div>
            `;
        }
    }
    html += '</div>';
    return html;
}

function renderGenres(genres) {
    if (!genres || genres.length === 0) return '';

    let html = '<div class="genres-list">';
    genres.forEach(genre => {
        html += `<a href="${genre.url || '#'}" class="genre-tag" target="_blank">${escapeHtml(genre.name)}</a>`;
    });
    html += '</div>';
    return html;
}

function extractSlug(url) {
    if (!url) return '';
    // Extract slug from URL
    const match = url.match(/\/([^\/]+)\/?$/);
    return match ? match[1] : '';
}

function renderFallbackState() {
    const container = document.getElementById('detailContent');
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <p>Gagal memuat detail anime. Silakan coba lagi nanti.</p>
                <a href="/v7/home" class="latest-episode-link" style="margin-top: 1rem;">← Kembali ke Beranda</a>
            </div>
        `;
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
            v7: '/v7/home'
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
    div.textContent = String(text);
    return div.innerHTML;
}
