// V4 Episode Page - Anichin
const API_BASE = '/api/v4/anichin';

// State
let currentEpisode = null;
let currentServer = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[V4 Episode] Initializing...');
    initializePage();
    setupServerSelector();
});

// Initialize page
async function initializePage() {
    try {
        // Get slug from URL
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('slug');

        if (!slug) {
            showError('Parameter episode tidak valid. URL harus: /v4/episode?slug=...');
            return;
        }

        console.log('[V4 Episode] Loading episode:', slug);

        // Fetch episode data
        const response = await fetch(`${API_BASE}/episode?slug=${encodeURIComponent(slug)}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            currentEpisode = result.data;
            displayEpisode(currentEpisode);
        } else {
            showError(result.message || 'Gagal memuat data episode');
        }
    } catch (error) {
        console.error('[V4 Episode] Error:', error);
        showError('Terjadi kesalahan saat memuat episode');
    }
}

// Display episode content
function displayEpisode(episode) {
    const container = document.getElementById('episodeContent');

    // Extract episode info
    const animeTitle = episode.anime_title || 'Anime';
    const episodeTitle = episode.title || episode.episode_title || 'Episode';
    const streamingServers = episode.streaming_servers || [];
    const downloadLinks = episode.download_links || [];
    const episodeList = episode.episode_list || [];
    const navigation = episode.navigation || {};

    // Get current video URL
    const currentVideoUrl = streamingServers.length > 0 && streamingServers[currentServer] && streamingServers[currentServer].sources.length > 0
        ? streamingServers[currentServer].sources[0].url
        : '';

    container.innerHTML = `
        <!-- Video Player Section -->
        <div class="video-section">
            <div class="video-header">
                <h1 class="video-title">${escapeHtml(animeTitle)}</h1>
                <div class="video-subtitle">${escapeHtml(episodeTitle)}</div>
            </div>
            <div class="video-player" id="videoPlayer">
                ${currentVideoUrl ? `<iframe src="${currentVideoUrl}" allowfullscreen></iframe>` : '<div class="loading"><p>Video tidak tersedia</p></div>'}
            </div>
        </div>

        <!-- Server Selection -->
        ${streamingServers.length > 0 ? `
        <div class="server-section">
            <h3>🎬 Pilih Server</h3>
            <div class="server-list" id="serverList">
                ${streamingServers.map((server, index) => `
                    <button class="server-btn ${index === currentServer ? 'active' : ''}"
                            onclick="changeServer(${index})"
                            data-server-index="${index}">
                        ${escapeHtml(server.name || `Server ${index + 1}`)}
                    </button>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- Episode Navigation -->
        ${episodeList.length > 0 ? `
        <div class="episode-nav">
            <div class="nav-buttons">
                <button class="nav-btn"
                        onclick="navigateEpisode('prev')"
                        ${!navigation.prev_episode ? 'disabled' : ''}>
                    ← Episode Sebelumnya
                </button>
                <a href="${episode.anime_detail_url || '/v4/home'}" class="nav-btn" style="text-decoration: none;">
                    📋 Detail Anime
                </a>
                <button class="nav-btn"
                        onclick="navigateEpisode('next')"
                        ${!navigation.next_episode ? 'disabled' : ''}>
                    Episode Selanjutnya →
                </button>
            </div>

            <div class="episode-list-section">
                <h3>📺 Daftar Episode</h3>
                <div class="episode-grid">
                    ${episodeList.map(ep => {
                        const epNum = ep.episode || ep.title.match(/\d+/)?.[0] || '';
                        const isActive = ep.is_active || ep.url === window.location.pathname;
                        const isNew = ep.is_new || false;

                        return `
                            <a href="/v4/episode?slug=${extractSlugFromUrl(ep.url)}"
                               class="episode-item ${isActive ? 'active' : ''}"
                               title="${escapeHtml(ep.title)}">
                                ${epNum ? `Ep ${epNum}` : escapeHtml(ep.title)}
                                ${isNew ? ' 🔥' : ''}
                            </a>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Download Section -->
        ${downloadLinks.length > 0 ? `
        <div class="download-section">
            <h3>📥 Download Episode</h3>
            ${groupDownloadLinksByQuality(downloadLinks).map(group => `
                <div class="quality-group">
                    <h4>${escapeHtml(group.quality)}</h4>
                    <div class="download-links">
                        ${group.links.map(link => `
                            <a href="${link.url}"
                               target="_blank"
                               class="download-btn"
                               rel="noopener noreferrer">
                                ${escapeHtml(link.provider || link.host || 'Download')}
                            </a>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
    `;
}

// Change streaming server
function changeServer(serverIndex) {
    if (!currentEpisode || !currentEpisode.streaming_servers) return;

    const servers = currentEpisode.streaming_servers;
    if (serverIndex < 0 || serverIndex >= servers.length) return;

    currentServer = serverIndex;

    // Update video player
    const videoPlayer = document.getElementById('videoPlayer');
    const server = servers[serverIndex];
    const videoUrl = server.sources && server.sources.length > 0 ? server.sources[0].url : '';

    if (videoUrl) {
        videoPlayer.innerHTML = `<iframe src="${videoUrl}" allowfullscreen></iframe>`;
    } else {
        videoPlayer.innerHTML = '<div class="loading"><p>Video tidak tersedia</p></div>';
    }

    // Update active button
    document.querySelectorAll('.server-btn').forEach((btn, index) => {
        if (index === serverIndex) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    console.log('[V4 Episode] Changed to server:', server.name);
}

// Navigate to prev/next episode
function navigateEpisode(direction) {
    if (!currentEpisode || !currentEpisode.navigation) return;

    const nav = currentEpisode.navigation;
    let targetUrl = null;

    if (direction === 'prev' && nav.prev_episode) {
        targetUrl = nav.prev_episode.url;
    } else if (direction === 'next' && nav.next_episode) {
        targetUrl = nav.next_episode.url;
    }

    if (targetUrl) {
        const slug = extractSlugFromUrl(targetUrl);
        if (slug) {
            window.location.href = `/v4/episode?slug=${encodeURIComponent(slug)}`;
        }
    }
}

// Group download links by quality
function groupDownloadLinksByQuality(links) {
    const grouped = {};

    links.forEach(link => {
        const quality = link.quality || 'Unknown Quality';
        if (!grouped[quality]) {
            grouped[quality] = [];
        }
        grouped[quality].push(link);
    });

    return Object.entries(grouped).map(([quality, links]) => ({
        quality,
        links
    }));
}

// Extract slug from URL
function extractSlugFromUrl(url) {
    if (!url) return '';

    // For Anichin URLs like: /supreme-alchemy-episode-167-subtitle-indonesia
    // or: https://anichin.cafe/supreme-alchemy-episode-167-subtitle-indonesia

    try {
        // Remove domain if present
        const path = url.startsWith('http') ? new URL(url).pathname : url;

        // Remove leading/trailing slashes
        const slug = path.replace(/^\/+|\/+$/g, '');

        return slug;
    } catch (e) {
        console.error('[V4 Episode] Error extracting slug:', e);
        return url;
    }
}

// Show error message
function showError(message) {
    const container = document.getElementById('episodeContent');
    container.innerHTML = `
        <div class="error">
            <h2>❌ ${escapeHtml(message)}</h2>
            <p>Silakan coba lagi nanti atau kembali ke <a href="/v4/home" style="color: #ffd700;">beranda</a>.</p>
        </div>
    `;
}

// Setup server selector
function setupServerSelector() {
    const selector = document.getElementById('serverSelect');
    if (!selector) return;

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
        }
    });
}

// Utility: Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

console.log('[V4 Episode] Episode page loaded');
