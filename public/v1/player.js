const API_BASE = '/api';

let currentEpisodeData = null;
let currentServerId = null;
let playerRequestSeq = 0;
let activePlayerAbortController = null;
const PLAYER_FETCH_TIMEOUT_MS = 20000;
const playerState = {
    fallbackUrl: '',
    mode: 'loading'
};

function getPlayerWrapper() {
    return document.getElementById('videoWrapper');
}

function startPlayerRequest() {
    playerRequestSeq += 1;

    if (activePlayerAbortController) {
        activePlayerAbortController.abort();
    }

    activePlayerAbortController = new AbortController();
    return {
        id: playerRequestSeq,
        signal: activePlayerAbortController.signal
    };
}

function isCurrentPlayerRequest(requestId) {
    return requestId === playerRequestSeq;
}

async function fetchJsonWithTimeout(url, { signal, timeoutMs = PLAYER_FETCH_TIMEOUT_MS } = {}) {
    const controller = new AbortController();
    let didTimeout = false;

    const abortFromParent = () => controller.abort();
    if (signal) {
        if (signal.aborted) {
            controller.abort();
        } else {
            signal.addEventListener('abort', abortFromParent, { once: true });
        }
    }

    const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (didTimeout && error.name === 'AbortError') {
            error.isTimeout = true;
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        if (signal) {
            signal.removeEventListener('abort', abortFromParent);
        }
    }
}

function getPlayerAlertBox() {
    return document.getElementById('playerAlert');
}

function updatePlayerAlert(message = '', type = 'info') {
    const alertBox = getPlayerAlertBox();
    if (!alertBox) return;
    if (!message) {
        alertBox.textContent = '';
        alertBox.classList.remove('visible', 'error');
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
    playerState.mode = 'loading';
    if (window.AnimMeOPlayer) {
        window.AnimMeOPlayer.destroyOPlayer();
    }
    updatePlayerAlert('');
    wrapper.replaceChildren();

    const loading = document.createElement('div');
    loading.className = 'player-loading';

    const dot = document.createElement('span');
    dot.className = 'loader-dot';

    const text = document.createElement('p');
    text.textContent = message;

    loading.appendChild(dot);
    loading.appendChild(text);
    wrapper.appendChild(loading);
}

function showPlayerError(message) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    playerState.mode = 'error';
    if (window.AnimMeOPlayer) {
        window.AnimMeOPlayer.destroyOPlayer();
    }
    wrapper.replaceChildren();

    const errorBox = document.createElement('div');
    errorBox.className = 'player-error';
    errorBox.textContent = message;
    wrapper.appendChild(errorBox);
    updatePlayerAlert(message, 'error');
}

function renderIframePlayer(url) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;
    if (!url) {
        showPlayerError('Stream tidak tersedia untuk ditampilkan.');
        return;
    }
    playerState.mode = 'iframe';
    if (window.AnimMeOPlayer) {
        window.AnimMeOPlayer.destroyOPlayer();
    }
    wrapper.replaceChildren();

    const iframe = document.createElement('iframe');
    iframe.id = 'videoPlayer';
    iframe.src = url;
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('webkitallowfullscreen', '');
    iframe.setAttribute('mozallowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation';
    iframe.allow = 'autoplay *; fullscreen *; encrypted-media *; accelerometer *; gyroscope *; picture-in-picture *; clipboard-write *; web-share *';
    wrapper.appendChild(iframe);
    updatePlayerAlert('Mode iframe aktif. Gunakan tombol fullscreen jika video masih tampak kecil.');
}

function renderVideoPlayer(resolvedData, fallbackUrl, options = {}) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;

    const oplayer = window.AnimMeOPlayer;
    const bestUrl = oplayer?.pickBestSource(resolvedData) || fallbackUrl;

    if (oplayer?.isAvailable() && bestUrl) {
        playerState.mode = 'oplayer';
        const player = oplayer.createOPlayer(wrapper, bestUrl, {
            autoplay: Boolean(options.autoplay),
            primaryColor: '#e50914'
        });
        if (player) {
            updatePlayerAlert('OPlayer aktif. Gunakan kontrol player untuk kualitas dan kecepatan.');
            return;
        }
    }

    const sources = Array.isArray(resolvedData?.sources) ? resolvedData.sources : [];
    if (!sources.length) {
        renderIframePlayer(fallbackUrl);
        return;
    }

    playerState.mode = 'video';
    if (window.AnimMeOPlayer) {
        window.AnimMeOPlayer.destroyOPlayer();
    }
    wrapper.replaceChildren();

    const video = document.createElement('video');
    video.id = 'videoPlayer';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('controlsList', 'nodownload');
    video.setAttribute('webkit-playsinline', 'true');
    if (resolvedData.poster) {
        video.poster = resolvedData.poster;
    }
    if (options.autoplay) {
        video.autoplay = true;
    }
    sources.forEach((source) => {
        if (!source?.url) return;
        const sourceEl = document.createElement('source');
        sourceEl.src = source.url;
        if (source.mime) {
            sourceEl.type = source.mime;
        }
        if (source.quality) {
            sourceEl.setAttribute('data-quality', source.quality);
        }
        video.appendChild(sourceEl);
    });
    video.addEventListener('error', () => {
        updatePlayerAlert('Video gagal dimuat, mengganti ke mode iframe...', 'error');
        renderIframePlayer(fallbackUrl);
    });
    wrapper.appendChild(video);
    updatePlayerAlert('Mode direct player aktif. Klik tombol server lain jika ingin ganti sumber.');
}

function applyStreamToPlayer(streamPayload, options = {}) {
    const fallbackUrl = streamPayload?.stream_url || '';
    playerState.fallbackUrl = fallbackUrl;
    const resolvedData = streamPayload?.resolved;
    if (resolvedData && resolvedData.type === 'video') {
        renderVideoPlayer(resolvedData, fallbackUrl, options);
    } else {
        renderIframePlayer(fallbackUrl);
    }
}

async function resolveStreamFromUrl(streamUrl, signal) {
    if (!streamUrl) return null;
    try {
        const encoded = encodeURIComponent(streamUrl);
        const payload = await fetchJsonWithTimeout(`${API_BASE}/resolve-stream?url=${encoded}`, { signal });
        if (payload.status === 'success') {
            return payload.data;
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error resolving stream:', error);
        }
    }
    return null;
}

async function initDefaultPlayer(defaultUrl) {
    const request = startPlayerRequest();

    if (!defaultUrl) {
        showPlayerError('Stream default tidak ditemukan.');
        return;
    }
    showPlayerLoading('Mengambil pemutar terbaik...');
    const resolved = await resolveStreamFromUrl(defaultUrl, request.signal);
    if (!isCurrentPlayerRequest(request.id)) return;

    if (resolved) {
        applyStreamToPlayer(resolved);
    } else {
        applyStreamToPlayer({ stream_url: defaultUrl });
    }
}

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

function getEpisodeSlugFromURL() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);

    // /v1/player/:episode
    if (pathParts.length >= 3 && pathParts[0] === 'v1' && pathParts[1] === 'player') {
        return pathParts[2];
    }

    // /player/:episode (legacy)
    if (pathParts.length >= 2 && pathParts[0] === 'player') {
        return pathParts[1];
    }

    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('episode');
}

async function loadEpisodeData() {
    const episodeSlug = getEpisodeSlugFromURL();

    if (!episodeSlug) {
        showError('Episode tidak ditemukan!');
        return;
    }

    const data = await fetchAPI(`/episode/${episodeSlug}`);

    if (!data || !data.data) {
        showError('Data episode tidak ditemukan!');
        return;
    }

    currentEpisodeData = data.data;
    displayEpisodePlayer(data.data);
}

function createDownloadSection(episode) {
    if (!episode.download_links || episode.download_links.length === 0) {
        return null;
    }

    const section = document.createElement('div');
    section.className = 'download-section';

    const title = document.createElement('h3');
    title.className = 'section-title';
    title.textContent = 'Download Episode';
    section.appendChild(title);

    const list = document.createElement('div');
    list.className = 'download-list';

    episode.download_links.forEach((item) => {
        const downloadItem = document.createElement('div');
        downloadItem.className = 'download-item';

        const quality = document.createElement('div');
        quality.className = 'download-quality';
        quality.textContent = `${item.quality}${item.size ? ` (${item.size})` : ''}`;

        const links = document.createElement('div');
        links.className = 'download-links';

        (item.links || []).forEach((link) => {
            const anchor = document.createElement('a');
            anchor.href = link.url || '#';
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            anchor.className = 'download-btn';
            anchor.textContent = link.host || 'Download';
            links.appendChild(anchor);
        });

        downloadItem.appendChild(quality);
        downloadItem.appendChild(links);
        list.appendChild(downloadItem);
    });

    section.appendChild(list);
    return section;
}

function createStreamingSection(episode) {
    if (!episode.streaming_mirrors || !episode.post_id) {
        return null;
    }

    const hasServers = Object.values(episode.streaming_mirrors).some((servers) => servers && servers.length > 0);
    if (!hasServers) {
        return null;
    }

    const section = document.createElement('div');
    section.className = 'streaming-section';

    const title = document.createElement('h3');
    title.className = 'section-title';
    title.textContent = 'Pilih Kualitas & Server Streaming';
    section.appendChild(title);

    const mirrors = document.createElement('div');
    mirrors.className = 'streaming-mirrors';

    Object.keys(episode.streaming_mirrors).forEach((quality) => {
        const servers = episode.streaming_mirrors[quality];
        if (!servers || servers.length === 0) return;

        const group = document.createElement('div');
        group.className = 'quality-group';

        const label = document.createElement('div');
        label.className = 'quality-label';
        label.textContent = quality;

        const buttons = document.createElement('div');
        buttons.className = 'server-buttons';

        servers.forEach((server, idx) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `server-btn${idx === 0 && quality === '480p' ? ' active' : ''}`;
            button.textContent = server.server || `Server ${idx + 1}`;
            button.addEventListener('click', () => {
                changeServer(episode.post_id, quality, idx, server.server || `Server ${idx + 1}`, button);
            });
            buttons.appendChild(button);
        });

        group.appendChild(label);
        group.appendChild(buttons);
        mirrors.appendChild(group);
    });

    section.appendChild(mirrors);
    return section;
}

function createNavButton(label, href, disabled = false) {
    if (disabled) {
        const span = document.createElement('span');
        span.className = 'nav-btn disabled';
        span.textContent = label;
        return span;
    }

    const link = document.createElement('a');
    link.href = href;
    link.className = 'nav-btn';
    link.textContent = label;
    return link;
}

function displayEpisodePlayer(episode) {
    const container = document.getElementById('playerContent');
    container.replaceChildren();

    const defaultStreamUrl = episode.default_stream_url || null;
    playerState.fallbackUrl = defaultStreamUrl || '';

    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    videoWrapper.id = 'videoWrapper';

    const loading = document.createElement('div');
    loading.className = 'player-loading';
    const dot = document.createElement('span');
    dot.className = 'loader-dot';
    const loadingText = document.createElement('p');
    loadingText.textContent = 'Menyiapkan video player...';
    loading.appendChild(dot);
    loading.appendChild(loadingText);
    videoWrapper.appendChild(loading);

    const alertBox = document.createElement('div');
    alertBox.id = 'playerAlert';
    alertBox.className = 'player-alert';
    alertBox.setAttribute('role', 'status');
    alertBox.setAttribute('aria-live', 'polite');

    const episodeInfo = document.createElement('div');
    episodeInfo.className = 'episode-info';

    const episodeTitle = document.createElement('h2');
    episodeTitle.className = 'episode-title';
    episodeTitle.textContent = episode.title || 'Episode';
    episodeInfo.appendChild(episodeTitle);

    let animeSlug = '';
    if (episode.anime_detail_url) {
        const match = episode.anime_detail_url.match(/\/anime\/([^/]+)/);
        animeSlug = match ? match[1] : '';
    }

    if (animeSlug) {
        const backLink = document.createElement('p');
        backLink.style.color = '#999';
        backLink.style.marginTop = '10px';

        const anchor = document.createElement('a');
        anchor.href = `/detail/${animeSlug}`;
        anchor.style.color = '#e50914';
        anchor.style.textDecoration = 'none';
        anchor.textContent = '← Kembali ke Detail Anime';
        backLink.appendChild(anchor);
        episodeInfo.appendChild(backLink);
    }

    const navSection = document.createElement('div');
    navSection.className = 'navigation-section';
    navSection.appendChild(createNavButton(
        '← Episode Sebelumnya',
        episode.prev_episode ? `/v1/player/${episode.prev_episode}` : '#',
        !episode.prev_episode
    ));
    navSection.appendChild(createNavButton(
        'Episode Selanjutnya →',
        episode.next_episode ? `/v1/player/${episode.next_episode}` : '#',
        !episode.next_episode
    ));

    container.appendChild(videoWrapper);
    container.appendChild(alertBox);
    container.appendChild(episodeInfo);

    const streamingSection = createStreamingSection(episode);
    if (streamingSection) {
        container.appendChild(streamingSection);
    }

    container.appendChild(navSection);

    const downloadSection = createDownloadSection(episode);
    if (downloadSection) {
        container.appendChild(downloadSection);
    }

    updatePlayerAlert('');
    if (defaultStreamUrl) {
        initDefaultPlayer(defaultStreamUrl);
    } else {
        showPlayerError('Stream default tidak ditemukan.');
    }
}

async function changeServer(postId, quality, serverIndex, serverName, buttonElement) {
    const wrapper = getPlayerWrapper();
    if (!wrapper) return;

    const request = startPlayerRequest();
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Loading...';
    buttonElement.disabled = true;
    showPlayerLoading(`Menghubungkan ke ${serverName} (${quality})...`);

    try {
        const data = await fetchJsonWithTimeout(
            `${API_BASE}/stream/${postId}/${quality}/${serverIndex}?resolve=1`,
            { signal: request.signal }
        );
        if (!isCurrentPlayerRequest(request.id)) return;

        if (data.status === 'success' && data.data.stream_url) {
            applyStreamToPlayer(data.data, { autoplay: true });
            document.querySelectorAll('.server-btn').forEach((btn) => btn.classList.remove('active'));
            buttonElement.classList.add('active');
        } else {
            throw new Error('Failed to get stream URL');
        }
    } catch (error) {
        if (!isCurrentPlayerRequest(request.id)) return;

        if (error.isTimeout) {
            updatePlayerAlert('Request server terlalu lama. Coba server lain.', 'error');
        } else if (error.name === 'AbortError') {
            return;
        } else {
            console.error('Error switching server:', error);
            updatePlayerAlert('Gagal mengganti server. Silakan coba server lain atau refresh halaman.', 'error');
        }

        if (playerState.fallbackUrl) {
            renderIframePlayer(playerState.fallbackUrl);
        }
    } finally {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
    }
}

function showError(message) {
    const container = document.getElementById('playerContent');
    container.replaceChildren();
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = message;
    container.appendChild(error);
}

document.addEventListener('DOMContentLoaded', () => {
    loadEpisodeData();
});