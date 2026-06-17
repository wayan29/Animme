// AnimMe V5 - Anoboy Episode Page
const API_BASE = '/api/v5/anoboy';

function getSlugFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug') || '';
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('[V5] Episode page initialized');
    const slug = getSlugFromUrl();

    if (!slug) {
        showError('Slug episode tidak ditemukan di URL');
        return;
    }

    loadEpisode(slug);
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
});

async function loadEpisode(slug) {
    try {
        console.log(`[V5] Loading episode: ${slug}`);

        const response = await fetch(`${API_BASE}/episode/${slug}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            renderEpisode(result.data);
        } else {
            showError(result.message || 'Gagal memuat episode');
        }
    } catch (error) {
        console.error('[V5] Error loading episode:', error);
        showError('Terjadi kesalahan saat memuat data');
    }
}

function renderEpisode(data) {
    const container = document.getElementById('episodeContainer');

    const videoSource = data.video_sources && data.video_sources.length > 0
        ? data.video_sources[0]
        : null;

    const videoHtml = videoSource
        ? `<div class="video-container">
            <iframe src="${videoSource.url}" frameborder="0" allowfullscreen allow="autoplay"></iframe>
           </div>`
        : `<div class="video-info" style="text-align: center; padding: 3rem;">
            <p style="color: #ff4444; font-size: 1.2rem;">⚠️ Video tidak tersedia</p>
           </div>`;

    const prevBtn = data.navigation && data.navigation.prev_episode
        ? `<a href="/v5/episode?slug=${encodeURIComponent(data.navigation.prev_episode.slug)}" class="nav-btn">« Previous</a>`
        : `<button class="nav-btn" disabled>« Previous</button>`;

    const nextBtn = data.navigation && data.navigation.next_episode
        ? `<a href="/v5/episode?slug=${encodeURIComponent(data.navigation.next_episode.slug)}" class="nav-btn">Next »</a>`
        : `<button class="nav-btn" disabled>Next »</button>`;

    container.innerHTML = `
        <h1 class="episode-title">${escapeHtml(data.title)}</h1>

        ${videoHtml}

        <div class="video-info">
            ${data.anime_title ? `<p><span class="info-label">Anime:</span>${escapeHtml(data.anime_title)}</p>` : ''}
            ${videoSource ? `<p><span class="info-label">Provider:</span>${escapeHtml(videoSource.provider)}</p>` : ''}
            ${videoSource ? `<p><span class="info-label">Quality:</span>${escapeHtml(videoSource.quality)}</p>` : ''}
            ${data.video_sources ? `<p><span class="info-label">Available Sources:</span>${data.video_sources.length}</p>` : ''}
        </div>

        <div class="navigation-buttons">
            ${prevBtn}
            ${nextBtn}
        </div>
    `;
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `<div class="error">⚠️ ${message}</div>`;
    errorContainer.style.display = 'block';

    const episodeContainer = document.getElementById('episodeContainer');
    episodeContainer.innerHTML = '';
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
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

function setupServerSelector() {
    const selector = document.getElementById('serverSelect');
    selector.addEventListener('change', (e) => {
        window.location.href = `/${e.target.value}/home`;
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
    });

    const closeSidebar = () => {
        sidebar.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
    };

    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);
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
            if (e.key === 'Enter') searchAnime();
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

console.log('[V5] Episode script loaded');
