// AnimMe V6 - AnimeIndo Episode Page
const API_BASE = '/api/v6/animeindo';

const episodeState = {
    slug: null,
    data: null,
    isLoading: false,
    error: null,
    activeEmbed: null
};

document.addEventListener('DOMContentLoaded', () => {
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    initializeEpisode();
});

function initializeEpisode() {
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get('slug') || params.get('s') || '';

    if (!slugParam) {
        showError('Parameter slug tidak ditemukan.');
        renderFallback();
        return;
    }

    episodeState.slug = slugParam;
    loadEpisodeData(slugParam);
}

async function loadEpisodeData(slug) {
    episodeState.isLoading = true;
    showLoading();
    hideError();

    try {
        const response = await fetch(`${API_BASE}/episode/${encodeSlug(slug)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Data tidak valid');
        }

        episodeState.data = payload.data;
        episodeState.activeEmbed = payload.data.default_embed || (payload.data.servers?.[0]?.embed_url ?? null);
        renderEpisode();
    } catch (error) {
        console.error('[V6] Episode API error:', error);
        showError('Gagal memuat episode.');
        renderFallback();
    } finally {
        episodeState.isLoading = false;
    }
}

function renderEpisode() {
    const container = document.getElementById('episodeContainer');
    if (!container || !episodeState.data) return;

    const episode = episodeState.data;
    const poster = episode.poster || episode.poster_original || '/images/placeholder.jpg';
    const servers = Array.isArray(episode.servers) ? episode.servers : [];
    const downloads = Array.isArray(episode.downloads) ? episode.downloads : [];
    const navigation = episode.navigation || {};

    const serverButtons = servers.length
        ? servers.map((server, index) => {
            const isActive = matchUrl(episodeState.activeEmbed, server.embed_url) || (index === 0 && !episodeState.activeEmbed);
            return `
                <button class="server-button ${isActive ? 'active' : ''}" data-embed="${server.embed_url || ''}">
                    ${escapeHtml(server.name || `Server ${index + 1}`)}
                </button>
            `;
        }).join('')
        : '<span class="server-button active" data-embed="">Server tidak tersedia</span>';

    const downloadLinks = downloads.length
        ? downloads.map(item => `
            <a href="${item.url}" class="download-link" target="_blank" rel="noopener">
                ${escapeHtml(item.name || 'Download')}
            </a>
        `).join('')
        : '<div class="download-link" style="pointer-events:none;opacity:0.6;">Download tidak tersedia</div>';

    const navLinks = [
        navigation.previous ? `<a class="nav-link-btn" href="${navigation.previous}">« Sebelumnya</a>` : '',
        navigation.all_episodes ? `<a class="nav-link-btn" href="/v6/detail?slug=${encodeURIComponent(extractSlug(navigation.all_episodes))}">📺 Semua Episode</a>` : '',
        navigation.next ? `<a class="nav-link-btn" href="${navigation.next}">Berikutnya »</a>` : ''
    ].filter(Boolean).join('');

    const embedUrl = episodeState.activeEmbed || episode.default_embed || '';
    const safeEmbed = embedUrl ? embedUrl : 'about:blank';

    container.innerHTML = `
        <section>
            <h1 class="episode-title">${escapeHtml(episode.title || 'Episode')}</h1>
            <div class="episode-meta">
                <span>Streaming dari AnimeIndo</span>
                ${episode.anime_slug ? `<span><a href="/v6/detail?slug=${encodeURIComponent(episode.anime_slug)}" class="nav-link-btn">Lihat Detail Anime</a></span>` : ''}
            </div>
            <div class="player-wrapper">
                <iframe id="episodePlayer" src="${safeEmbed}" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe>
            </div>
            <div class="servers-grid" id="serverButtons">
                ${serverButtons}
            </div>
            <div class="nav-links">
                ${navLinks || '<span style="color:rgba(226,239,255,0.6);">Navigasi episode tidak tersedia.</span>'}
            </div>
        </section>

        <section>
            <h2 class="section-title">Deskripsi</h2>
            <div class="description">
                ${escapeHtml(episode.synopsis || 'Sinopsis tidak tersedia.')}
            </div>
        </section>

        <section>
            <h2 class="section-title">Download</h2>
            <div class="download-list">
                ${downloadLinks}
            </div>
        </section>
    `;

    bindServerButtons();
}

function renderFallback() {
    const container = document.getElementById('episodeContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="description">
            Data episode tidak dapat ditampilkan saat ini.
        </div>
    `;
}

function bindServerButtons() {
    const buttons = document.querySelectorAll('#serverButtons .server-button');
    if (!buttons.length) return;

    const player = document.getElementById('episodePlayer');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const embedUrl = button.getAttribute('data-embed');
            episodeState.activeEmbed = embedUrl;

            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            if (player && embedUrl) {
                player.src = embedUrl;
            }
        });
    });
}

function showLoading() {
    const container = document.getElementById('episodeContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Memuat data episode...</p>
        </div>
    `;
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
    errorContainer.style.display = 'block';
    episodeState.error = message;
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    episodeState.error = null;
}

function encodeSlug(slug) {
    return slug
        .split('/')
        .filter(Boolean)
        .map(encodeURIComponent)
        .join('/');
}

function extractSlug(url) {
    try {
        const parsed = new URL(url);
        return parsed.pathname.replace(/^\/|\/$/g, '');
    } catch (error) {
        return url.replace(/^\/|\/$/g, '');
    }
}

function matchUrl(current, target) {
    if (!current || !target) return false;
    return current.replace(/\/+$/, '') === target.replace(/\/+$/, '');
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

console.log('[V6] AnimeIndo episode page initialized');
