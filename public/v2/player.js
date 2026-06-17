const API_BASE = '/api/v2';

let currentEpisode = null;
let activeServerIndex = null;
let isSwitchingServer = false;

function getPlayerWrapper() {
    return document.getElementById('videoWrapper');
}

function getAlertBox() {
    return document.getElementById('playerAlert');
}

function updateAlert(message = '', type = 'info') {
    const alertBox = getAlertBox();
    if (!alertBox) return;
    if (!message) {
        alertBox.classList.remove('visible', 'error');
        alertBox.textContent = '';
        return;
    }
    alertBox.textContent = message;
    alertBox.classList.add('visible');
    if (type === 'error') {
        alertBox.classList.add('error');
    } else {
        alertBox.classList.remove('error');
    }
}

function showPlayerLoading(message = 'Menyiapkan pemutar...') {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    wrapper.innerHTML = `
        <div class="player-loading">
            <span class="loader-dot"></span>
            <p>${message}</p>
        </div>
    `;
    updateAlert('');
}

function showPlayerError(message) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    wrapper.innerHTML = `<div class="player-error">${message}</div>`;
    updateAlert(message, 'error');
}

function renderIframePlayer(streamUrl) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    if (!streamUrl) {
        showPlayerError('Stream belum tersedia untuk episode ini.');
        return;
    }
    
    wrapper.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = streamUrl;
    iframe.allowFullscreen = true;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.allow = 'autoplay *; fullscreen *; encrypted-media *; accelerometer *; gyroscope *; picture-in-picture *; clipboard-write *; web-share *';
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation';
    wrapper.appendChild(iframe);
}

function getEpisodeSlugFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    // Check if URL parameter contains Kuramanime V3 URL
    const urlParam = params.get('url');
    if (urlParam && urlParam.includes('kuramanime.tel')) {
        // Extract animeId, slug, and episode from Kuramanime URL
        // Format: https://v8.kuramanime.tel/anime/{animeId}/{slug}/episode/{episodeNum}
        const match = urlParam.match(/\/anime\/(\d+)\/([^\/]+)\/episode\/(\d+)/);
        if (match) {
            const [, animeId, slug, episode] = match;
            // Redirect to V3 player
            const v3Url = `/v3/episode?animeId=${animeId}&slug=${slug}&episode=${episode}`;
            window.location.href = v3Url;
            return null; // Will redirect, so return null
        }
    }
    
    // Original V2 logic
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'player-v2' && pathParts[2]) {
        return pathParts[2];
    }
    return params.get('slug') || params.get('episode');
}

async function fetchEpisode(slug) {
    try {
        const response = await fetch(`${API_BASE}/episode/${slug}`);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const payload = await response.json();
        if (payload.status === 'success') {
            return payload.data;
        }
    } catch (error) {
        console.error('Error fetching episode:', error);
    }
    return null;
}

function renderEpisodeInfo(episode) {
    const infoContainer = document.getElementById('episodeInfo');
    if (!infoContainer) return;
    
    const poster = episode.poster || 'https://via.placeholder.com/400x600/0f0f0f/e50914?text=No+Image';
    const metaItems = [];
    
    if (episode.anime_title) metaItems.push({ label: 'Judul Anime', value: episode.anime_title });
    if (episode.episode_number) metaItems.push({ label: 'Episode', value: episode.episode_number });
    if (episode.release_time) metaItems.push({ label: 'Rilis', value: episode.release_time });
    
    infoContainer.innerHTML = `
        <div class="episode-info">
            <div class="episode-header">
                <div class="episode-poster">
                    <img src="${poster}" alt="${episode.title}">
                </div>
                <div class="episode-details">
                    <h1>${episode.title || 'Episode Terbaru'}</h1>
                    <h2>${episode.anime_title || ''}</h2>
                    <div class="episode-meta-grid">
                        ${metaItems.map(item => `
                            <div class="meta-card">
                                <div class="meta-label">${item.label}</div>
                                <div class="meta-value">${item.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            ${episode.description ? `<p class="episode-synopsis">${episode.description}</p>` : ''}
        </div>
    `;
    
    const backLink = document.getElementById('backToAnime');
    if (backLink && episode.anime_slug) {
        backLink.href = `/detail-v2/${episode.anime_slug}`;
    }
}

function renderDownloadSections(episode) {
    const container = document.getElementById('downloadContainer');
    if (!container) return;
    
    const sections = episode.download_sections && episode.download_sections.length > 0
        ? episode.download_sections
        : (episode.download_links && episode.download_links.length > 0
            ? [{ label: 'Download', items: episode.download_links }]
            : []);
    
    if (sections.length === 0) {
        container.innerHTML = `
            <div class="download-section">
                <h3 class="section-title">Download Episode</h3>
                <div class="empty-state">Link download belum tersedia.</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = sections.map(section => `
        <div class="download-section">
            <h3 class="section-title">${section.label || 'Download'}</h3>
            <div class="download-list">
                ${section.items.map(item => `
                    <div class="download-item">
                        <div class="download-quality">
                            ${item.quality || 'Unknown'}
                            ${item.size ? ` • ${item.size}` : ''}
                        </div>
                        <div class="download-links">
                            ${item.links.map(link => `
                                <a href="${link.url}" target="_blank" rel="noopener" class="download-btn">
                                    ${link.host}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderNavigation(episode) {
    const navContainer = document.getElementById('episodeNavigation');
    if (!navContainer) return;
    
    const hasPrev = Boolean(episode.prev_episode);
    const hasNext = Boolean(episode.next_episode);
    
    navContainer.innerHTML = `
        <div class="nav-section">
            <h3 class="section-title">Navigasi Episode</h3>
            <div class="nav-buttons">
                <button class="nav-btn prev" ${hasPrev ? `onclick="navigateEpisode('${episode.prev_episode}')"` : 'disabled'}>
                    ⬅ Episode Sebelumnya
                </button>
                <button class="nav-btn next" ${hasNext ? `onclick="navigateEpisode('${episode.next_episode}')"` : 'disabled'}>
                    Episode Selanjutnya ➡
                </button>
            </div>
        </div>
    `;
}

function navigateEpisode(slug) {
    if (!slug) return;
    window.location.href = `/player-v2/${slug}`;
}

function renderStreamingServers(episode) {
    const container = document.getElementById('streamingServers');
    if (!container) return;
    
    if (!episode.stream_servers || episode.stream_servers.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const buttonsHtml = episode.stream_servers.map((server, index) => `
        <button class="server-btn ${index === activeServerIndex ? 'active' : ''}" data-index="${index}">
            ${server.label || `Server ${index + 1}`}
        </button>
    `).join('');
    
    container.innerHTML = `
        <div class="server-section">
            <h3 class="section-title">Pilih Server Streaming</h3>
            <div class="server-grid">
                ${buttonsHtml}
            </div>
        </div>
    `;
    
    container.querySelectorAll('.server-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            switchToServer(idx);
        });
    });
}

function setActiveServerButton(index) {
    const buttons = document.querySelectorAll('#streamingServers .server-btn');
    buttons.forEach((btn, idx) => {
        btn.classList.toggle('active', idx === index);
    });
}

async function fetchServerStream(option) {
    if (!option || !currentEpisode) return null;
    const postId = option.post_id || currentEpisode.post_id;
    if (!postId) return null;
    
    const params = new URLSearchParams({
        post: postId,
        nume: option.nume || '1',
        type: option.type || 'schtml'
    });
    
    try {
        const response = await fetch(`${API_BASE}/player-stream?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const payload = await response.json();
        if (payload.status === 'success') {
            return payload.data;
        }
    } catch (error) {
        console.error('Error fetching player stream:', error);
    }
    return null;
}

async function switchToServer(index) {
    if (!currentEpisode || !currentEpisode.stream_servers) return;
    if (index < 0 || index >= currentEpisode.stream_servers.length) return;
    if (isSwitchingServer) return;
    if (activeServerIndex === index && currentEpisode.default_stream_url) return;
    
    const option = currentEpisode.stream_servers[index];
    if (!option) return;
    
    isSwitchingServer = true;
    setActiveServerButton(index);
    showPlayerLoading('Menghubungkan ke server...');
    
    try {
        const data = await fetchServerStream(option);
        if (data && data.stream_url) {
            renderIframePlayer(data.stream_url);
            currentEpisode.default_stream_url = data.stream_url;
            activeServerIndex = index;
            updateAlert(`Streaming dari ${option.label || 'server pilihan'}`);
        } else {
            showPlayerError('Gagal memuat server streaming.');
        }
    } finally {
        isSwitchingServer = false;
    }
}

async function initEpisodePage() {
    const slug = getEpisodeSlugFromURL();
    if (!slug) {
        showPlayerError('Slug episode tidak ditemukan.');
        return;
    }
    
    showPlayerLoading('Mengambil data episode...');
    const episode = await fetchEpisode(slug);
    
    if (!episode) {
        showPlayerError('Data episode gagal dimuat.');
        return;
    }
    
    currentEpisode = episode;
    document.title = `${episode.title || 'Episode'} - AnimMe V2`;
    renderEpisodeInfo(episode);
    activeServerIndex = 0;
    renderStreamingServers(episode);
    renderDownloadSections(episode);
    renderNavigation(episode);
    
    if (episode.default_stream_url) {
        renderIframePlayer(episode.default_stream_url);
    } else if (episode.stream_servers && episode.stream_servers.length > 0) {
        switchToServer(0);
    } else {
        showPlayerError('Stream belum tersedia.');
    }
}

document.addEventListener('DOMContentLoaded', initEpisodePage);
