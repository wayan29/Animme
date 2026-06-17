// AnimMe V5 - Anoboy Detail Page
const API_BASE = '/api/v5/anoboy';

// Get slug from URL
function getSlugFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug') || '';
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    console.log('[V5] Detail page initialized');
    const slug = getSlugFromUrl();

    if (!slug) {
        showError('Slug anime tidak ditemukan di URL');
        return;
    }

    loadAnimeDetail(slug);
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
});

// Load anime detail
async function loadAnimeDetail(slug) {
    try {
        console.log(`[V5] Loading detail for: ${slug}`);

        const response = await fetch(`${API_BASE}/detail/${slug}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            renderAnimeDetail(result.data);
        } else {
            showError(result.message || 'Gagal memuat detail anime');
        }
    } catch (error) {
        console.error('[V5] Error loading detail:', error);
        showError('Terjadi kesalahan saat memuat data');
    }
}

// Render anime detail
function renderAnimeDetail(data) {
    const container = document.getElementById('detailContainer');

    console.log('[V5] Rendering detail:', {
        title: data.title,
        episodes_count: data.episodes ? data.episodes.length : 0,
        has_episodes: !!(data.episodes && data.episodes.length > 0)
    });

    const genres = data.genres && data.genres.length > 0
        ? data.genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')
        : '<span class="genre-tag">N/A</span>';

    const episodes = data.episodes && data.episodes.length > 0
        ? data.episodes.map(ep => `
            <a href="/v5/episode?slug=${encodeURIComponent(ep.slug)}" class="episode-card">
                <div class="episode-number">Episode ${escapeHtml(ep.episode)}</div>
                ${ep.release_date ? `<div class="episode-date">${escapeHtml(ep.release_date)}</div>` : ''}
            </a>
        `).join('')
        : '<p style="grid-column: 1/-1; text-align: center; color: #888;">Belum ada episode tersedia</p>';

    console.log('[V5] Episodes HTML generated:', episodes.substring(0, 200));

    container.innerHTML = `
        <div class="detail-header">
            <div class="detail-poster" style="background-image: url('${data.poster || '/images/placeholder.jpg'}');"></div>
            <div class="detail-info">
                <h1 class="detail-title">${escapeHtml(data.title)}</h1>
                ${data.alternative_title ? `<div class="detail-alt-title">${escapeHtml(data.alternative_title)}</div>` : ''}

                <div class="detail-meta">
                    ${data.status ? `<div class="meta-item"><span class="meta-label">Status:</span><span class="meta-value">${escapeHtml(data.status)}</span></div>` : ''}
                    ${data.type ? `<div class="meta-item"><span class="meta-label">Type:</span><span class="meta-value">${escapeHtml(data.type)}</span></div>` : ''}
                    ${data.total_episodes ? `<div class="meta-item"><span class="meta-label">Episodes:</span><span class="meta-value">${escapeHtml(data.total_episodes)}</span></div>` : ''}
                    ${data.duration ? `<div class="meta-item"><span class="meta-label">Duration:</span><span class="meta-value">${escapeHtml(data.duration)}</span></div>` : ''}
                    ${data.release_date ? `<div class="meta-item"><span class="meta-label">Released:</span><span class="meta-value">${escapeHtml(data.release_date)}</span></div>` : ''}
                    ${data.studio ? `<div class="meta-item"><span class="meta-label">Studio:</span><span class="meta-value">${escapeHtml(data.studio)}</span></div>` : ''}
                    ${data.score ? `<div class="meta-item"><span class="meta-label">Score:</span><span class="meta-value">${escapeHtml(data.score)}</span></div>` : ''}
                </div>

                <div class="detail-genres">
                    ${genres}
                </div>

                ${data.synopsis ? `
                    <div class="detail-synopsis">
                        <div class="synopsis-title">Synopsis</div>
                        <p>${escapeHtml(data.synopsis)}</p>
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="episodes-section">
            <h2 class="section-title">
                Episode List
                <span class="section-badge">${data.episodes ? data.episodes.length : 0}</span>
            </h2>
            <div class="episodes-grid">
                ${episodes}
            </div>
        </div>
    `;
}

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `<div class="error">⚠️ ${message}</div>`;
    errorContainer.style.display = 'block';

    const detailContainer = document.getElementById('detailContainer');
    detailContainer.innerHTML = '';
}

// Utility function to escape HTML
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

// Setup server selector
function setupServerSelector() {
    const selector = document.getElementById('serverSelect');
    selector.addEventListener('change', (e) => {
        const version = e.target.value;
        window.location.href = `/${version}/home`;
    });
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
    };

    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

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

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchAnime();
        });
    }
}

// Search anime
function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (query) {
        window.location.href = `/v5/search?q=${encodeURIComponent(query)}`;
    }
}

console.log('[V5] Detail script loaded');
