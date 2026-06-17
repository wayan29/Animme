// AnimMe V7 - Nekopoi Episode Application
const API_BASE = '/api/v7/nekopoi';

const appState = {
    episodeData: null,
    currentStreamIndex: 0,
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
        showError('Slug episode tidak ditemukan di URL.');
        renderFallbackState();
        return;
    }

    try {
        await loadEpisode(slug);
    } catch (error) {
        console.error('[V7] Failed to initialize episode:', error);
        showError('Terjadi kesalahan saat memuat episode.');
    }
}

async function loadEpisode(slug) {
    appState.isLoading = true;
    hideError();
    showLoadingState();

    try {
        const response = await fetch(`${API_BASE}/episode/${encodeURIComponent(slug)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Respon dari server tidak valid');
        }

        appState.episodeData = payload.data;
        renderEpisode();
    } catch (error) {
        console.error('[V7] Episode API error:', error);
        showError('Gagal memuat data episode dari Nekopoi.');
        renderFallbackState();
    } finally {
        appState.isLoading = false;
    }
}

function showLoadingState() {
    const content = document.getElementById('episodeContent');
    if (content) {
        content.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat episode...</p>
            </div>
        `;
    }
}

function renderEpisode() {
    const container = document.getElementById('episodeContent');
    if (!container || !appState.episodeData) return;

    const {
        title,
        thumbnail,
        description,
        videoInfo,
        streamUrls,
        downloadLinks,
        genres,
        navigation
    } = appState.episodeData;

    container.innerHTML = '';

    // Player Section
    if (streamUrls && streamUrls.length > 0) {
        const playerSection = document.createElement('div');
        playerSection.innerHTML = `
            <h3 class="section-title">📺 Video Player</h3>
            <div class="player-wrapper" id="playerWrapper">
                ${renderPlayer(streamUrls[0])}
            </div>
            ${streamUrls.length > 1 ? renderServerButtons(streamUrls) : ''}
        `;
        container.appendChild(playerSection);
    }

    // Title & Info
    const infoSection = document.createElement('div');
    let infoHtml = `<h1 class="episode-title">${escapeHtml(title || 'Episode')}</h1>`;

    if (videoInfo && Object.keys(videoInfo).length > 0) {
        infoHtml += '<div class="episode-meta">';
        for (const [key, value] of Object.entries(videoInfo)) {
            infoHtml += `<span><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</span>`;
        }
        infoHtml += '</div>';
    }

    if (description) {
        infoHtml += `<div class="description">${escapeHtml(description)}</div>`;
    }

    infoSection.innerHTML = infoHtml;
    container.appendChild(infoSection);

    // Genres
    if (genres && genres.length > 0) {
        const genresSection = document.createElement('div');
        genresSection.innerHTML = `
            <h3 class="section-title">🏷️ Genre</h3>
            <div class="genres-list">
                ${genres.map(g => `<span class="genre-tag">${escapeHtml(g.name)}</span>`).join('')}
            </div>
        `;
        container.appendChild(genresSection);
    }

    // Download Links
    if (downloadLinks && downloadLinks.length > 0) {
        const downloadSection = document.createElement('div');
        downloadSection.innerHTML = `
            <h3 class="section-title">💾 Download Links</h3>
            <div class="download-list">
                ${downloadLinks.map(link =>
                    `<a href="${escapeHtml(link.url)}" class="download-link" target="_blank" rel="noopener">
                        ${escapeHtml(link.quality || 'Download')} ${link.host ? `(${escapeHtml(link.host)})` : ''}
                    </a>`
                ).join('')}
            </div>
        `;
        container.appendChild(downloadSection);
    }

    // Navigation
    if (navigation && (navigation.prev || navigation.next)) {
        const navSection = document.createElement('div');
        navSection.innerHTML = `
            <h3 class="section-title">🔗 Navigation</h3>
            <div class="nav-links">
                ${navigation.prev ?
                    `<a href="/v7/episode?slug=${encodeURIComponent(navigation.prev.slug)}" class="nav-link-btn">
                        ← ${escapeHtml(navigation.prev.title || 'Previous')}
                    </a>` : ''}
                ${navigation.next ?
                    `<a href="/v7/episode?slug=${encodeURIComponent(navigation.next.slug)}" class="nav-link-btn">
                        ${escapeHtml(navigation.next.title || 'Next')} →
                    </a>` : ''}
            </div>
        `;
        container.appendChild(navSection);
    }
}

function renderPlayer(streamData) {
    if (!streamData || !streamData.url) {
        return '<p style="text-align: center; padding: 2rem; color: rgba(255, 232, 232, 0.6);">Video tidak tersedia</p>';
    }

    // Check if it's a direct video URL
    if (streamData.type && streamData.type.includes('video/')) {
        return `<video controls><source src="${escapeHtml(streamData.url)}" type="${escapeHtml(streamData.type)}"></video>`;
    }

    // Otherwise, use iframe
    return `<iframe src="${escapeHtml(streamData.url)}" allowfullscreen></iframe>`;
}

function renderServerButtons(streamUrls) {
    return `
        <h3 class="section-title">🎬 Stream Servers</h3>
        <div class="servers-grid">
            ${streamUrls.map((stream, index) =>
                `<button class="server-button ${index === 0 ? 'active' : ''}" data-index="${index}">
                    ${escapeHtml(stream.provider || `Server ${index + 1}`)} ${stream.quality ? `- ${escapeHtml(stream.quality)}` : ''}
                </button>`
            ).join('')}
        </div>
    `;
}

function renderFallbackState() {
    const container = document.getElementById('episodeContent');
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <p>Gagal memuat episode. Silakan coba lagi nanti.</p>
                <a href="/v7/home" class="nav-link-btn" style="margin-top: 1rem;">← Kembali ke Beranda</a>
            </div>
        `;
    }
}

// Event delegation for server buttons
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('server-button')) {
        const index = parseInt(e.target.dataset.index, 10);
        if (!isNaN(index) && appState.episodeData?.streamUrls?.[index]) {
            switchStream(index);
        }
    }
});

function switchStream(index) {
    appState.currentStreamIndex = index;
    const streamData = appState.episodeData.streamUrls[index];

    const playerWrapper = document.getElementById('playerWrapper');
    if (playerWrapper && streamData) {
        playerWrapper.innerHTML = renderPlayer(streamData);
    }

    // Update active button
    document.querySelectorAll('.server-button').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
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
