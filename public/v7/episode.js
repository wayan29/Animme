// AnimMe V7 - Download-Only Episode Application
const API_BASE = '/api/v7/nekopoi';

const appState = {
    episodeData: null,
    downloadQueue: [],
    activeVideo: null,
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    
    // Setup page unload cleanup
    window.addEventListener('beforeunload', () => {
        if (appState.downloadQueue) {
            appState.downloadQueue.cleanup();
        }
    });
    
    // Setup page visibility change cleanup
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && appState.downloadQueue) {
            // Cleanup when page becomes hidden (user switches tabs)
            appState.downloadQueue.cleanupOldVideos();
        }
    });
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
        loadDownloadQueue();
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
        downloadLinks,
        genres,
        navigation
    } = appState.episodeData;

    container.innerHTML = '';

    // Download Queue Section
    const queueSection = document.createElement('div');
    queueSection.id = 'downloadQueue';
    container.appendChild(queueSection);

    // Video Player (for cached videos)
    const playerSection = document.createElement('div');
    playerSection.innerHTML = `
        <h3 class="section-title">📺 Video Player (Download Required)</h3>
        <div class="player-wrapper" id="videoPlayer">
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: rgba(255, 255, 255, 0.6); text-align: center; padding: 20px;">
                <div>
                    <p style="margin-bottom: 16px;">📥 Download video terlebih dahulu untuk menonton</p>
                    <p style="font-size: 0.9rem;">Video yang diunduh akan tersimpan di browser dan dapat diputar tanpa iklan</p>
                </div>
            </div>
        </div>
    `;
    container.appendChild(playerSection);

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

    // Stream URLs for testing (hidden by default)
    const { streamUrls } = appState.episodeData;
    if (streamUrls && streamUrls.length > 0) {
        const streamSection = document.createElement('div');
        streamSection.innerHTML = `
            <details style="background: rgba(243, 156, 18, 0.1); border: 1px solid rgba(243, 156, 18, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <summary style="cursor: pointer; font-weight: 600; color: var(--accent-color); font-size: 1.1rem;">
                    🧪 Test Streaming URLs (${streamUrls.length} found)
                </summary>
                <div style="margin-top: 16px;">
                    <p style="color: rgba(255, 232, 232, 0.7); margin-bottom: 12px; font-size: 0.9rem;">
                        Klik "Test" untuk cek apakah URL bisa di-download. Streaming embeds biasanya tidak bisa di-download langsung.
                    </p>
                    <div style="display: grid; gap: 8px;">
                        ${streamUrls.map(stream => `
                            <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 12px;">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; color: #ffe8e8; margin-bottom: 4px;">
                                        ${escapeHtml(stream.provider || 'Unknown')} - ${escapeHtml(stream.quality || 'Stream')}
                                    </div>
                                    <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${escapeHtml(stream.url)}
                                    </div>
                                </div>
                                <button class="host-btn" onclick="testDownloadUrl('${escapeHtml(stream.url)}', '${escapeHtml(stream.provider)} - ${escapeHtml(stream.quality)}')">
                                    🧪 Test
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </details>
        `;
        container.appendChild(streamSection);
    }

    // Download Links Section
    if (downloadLinks && downloadLinks.length > 0) {
        const groupedLinks = groupDownloadLinks(downloadLinks);

        if (groupedLinks.length > 0) {
            const downloadSection = document.createElement('div');
            downloadSection.innerHTML = `
                <h3 class="section-title">💾 Download Links</h3>
                <div class="download-links-section">
                    <div class="download-links-grid">
                        ${groupedLinks.map(group => `
                            <div class="download-card">
                                <div class="download-quality">${escapeHtml(group.quality)}</div>
                                <div class="download-hosts">
                                    ${group.links.map(link => {
                                        let isDirectVideo = false;
                                        try {
                                            const url = new URL(link.url);
                                            isDirectVideo = /\.(mp4|mkv|avi|webm|m3u8)$/i.test(url.pathname);
                                        } catch (e) {
                                            // Invalid URL, treat as external link
                                            isDirectVideo = false;
                                        }

                                        if (isDirectVideo) {
                                            return `<button class="host-btn" onclick="downloadVideo('${escapeHtml(link.url)}', '${escapeHtml(group.quality)} - ${escapeHtml(link.host)}')">
                                                ${escapeHtml(link.host)}
                                            </button>
                                            <button class="host-btn" onclick="testDownloadUrl('${escapeHtml(link.url)}', '${escapeHtml(group.quality)} - ${escapeHtml(link.host)}')" style="background: rgba(243, 156, 18, 0.2); border-color: rgba(243, 156, 18, 0.4);">
                                                🧪
                                            </button>`;
                                        } else {
                                            return `<a href="${escapeHtml(link.url)}" target="_blank" class="host-btn">
                                                ${escapeHtml(link.host)} ↗
                                            </a>
                                            <button class="host-btn" onclick="testDownloadUrl('${escapeHtml(link.url)}', '${escapeHtml(group.quality)} - ${escapeHtml(link.host)}')" style="background: rgba(243, 156, 18, 0.2); border-color: rgba(243, 156, 18, 0.4);">
                                                🧪
                                            </button>`;
                                        }
                                    }).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            container.appendChild(downloadSection);
        } else {
            // No valid download links found
            const noLinksSection = document.createElement('div');
            noLinksSection.innerHTML = `
                <div style="background: rgba(231, 76, 60, 0.1); border: 1px solid rgba(231, 76, 60, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
                    <h3 class="section-title">💾 Download Links</h3>
                    <p style="color: rgba(255, 232, 232, 0.7); margin-top: 12px;">
                        Tidak ada link download yang tersedia untuk episode ini.
                    </p>
                </div>
            `;
            container.appendChild(noLinksSection);
        }
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

function groupDownloadLinks(downloadLinks) {
    const groups = {};

    // Filter out invalid URLs for direct download
    const validLinks = downloadLinks.filter(link => {
        const url = link.url || '';
        const host = link.host || '';

        // Skip stream embed URLs (not downloadable)
        if (url.includes('fembed') || url.includes('femax') ||
            url.includes('streamtape') || url.includes('doodstream') ||
            url.includes('iframe')) {
            return false;
        }

        // Skip if host indicates it's a stream source
        if (host === 'Stream Source' || host === 'Direct Source') {
            return false;
        }

        // Skip if quality indicates it's a stream
        if (link.quality === 'Stream' || link.quality === 'Stream Quality' ||
            link.quality === 'Direct Video') {
            return false;
        }

        // Skip if URL doesn't look like a valid download URL
        if (!url.includes('drive.google') && !url.includes('mega.nz') &&
            !url.includes('mediafire') && !url.includes('zippyshare') &&
            !url.includes('anonfiles') && !url.includes('solidfiles') &&
            !url.includes('uptobox') && !url.includes('mirrorace') &&
            !/\.(mp4|mkv|avi|webm)(\?|$)/i.test(url)) {
            return false;
        }

        return true;
    });

    validLinks.forEach(link => {
        const quality = link.quality || 'Unknown';
        if (!groups[quality]) {
            groups[quality] = { quality, links: [] };
        }
        groups[quality].links.push({
            url: link.url,
            host: link.host || extractHost(link.url)
        });
    });
    return Object.values(groups);
}

function extractHost(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return 'unknown';
    }
}

// Download Queue Management
class DownloadQueue {
    constructor() {
        this.queues = this.loadFromStorage();
        this.cleanupInterval = null;
        this.initAutoCleanup();
        this.render();
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('v7_download_queue');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    saveToStorage() {
        localStorage.setItem('v7_download_queue', JSON.stringify(this.queues));
    }

    // Auto-cleanup unused videos after 1 hour
    initAutoCleanup() {
        // Clean up immediately on load
        this.cleanupOldVideos();

        // Set up periodic cleanup every 5 minutes
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldVideos();
        }, 5 * 60 * 1000); // 5 minutes
    }

    cleanupOldVideos() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        let cleanedCount = 0;

        this.queues = this.queues.filter(item => {
            // Remove items that are completed but older than 1 hour and not currently playing
            const isOldCompleted = item.status === 'completed' && 
                                new Date(item.updatedAt || item.addedAt) < oneHourAgo && 
                                !this.isCurrentlyPlaying(item);

            if (isOldCompleted) {
                // Revoke blob URL to free memory
                if (item.blob) {
                    try {
                        URL.revokeObjectURL(URL.createObjectURL(item.blob));
                        console.log(`[V7] Cleaned up old video: ${item.name}`);
                        cleanedCount++;
                    } catch (error) {
                        console.warn(`[V7] Failed to revoke blob URL for: ${item.name}`, error);
                    }
                }
                return false; // Remove from queue
            }
            return true; // Keep in queue
        });

        if (cleanedCount > 0) {
            this.saveToStorage();
            console.log(`[V7] Auto-cleanup: removed ${cleanedCount} old video(s) from cache`);
        }
    }

    isCurrentlyPlaying(item) {
        return appState.activeVideo && appState.activeVideo.id === item.id;
    }

    // Enhanced cleanup when page is unloading
    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        // Revoke all blob URLs to free memory
        this.queues.forEach(item => {
            if (item.blob && !this.isCurrentlyPlaying(item)) {
                try {
                    URL.revokeObjectURL(URL.createObjectURL(item.blob));
                } catch (error) {
                    // Ignore errors during cleanup
                }
            }
        });
    }

    // Enhanced remove function with additional cleanup
    removeFromQueue(id) {
        const index = this.queues.findIndex(item => item.id === id);
        if (index !== -1) {
            const item = this.queues[index];
            
            // Revoke blob URL if exists
            if (item.blob) {
                try {
                    URL.revokeObjectURL(URL.createObjectURL(item.blob));
                } catch (error) {
                    console.warn(`[V7] Failed to revoke blob URL for removed item: ${item.name}`, error);
                }
            }
            
            this.queues.splice(index, 1);
            this.saveToStorage();
            this.render();
        }
    }

    // Manual cleanup function that can be called by user
    manualCleanup() {
        const beforeCount = this.queues.length;
        
        // Remove all completed videos except currently playing one
        this.queues = this.queues.filter(item => {
            const shouldKeep = item.status !== 'completed' || this.isCurrentlyPlaying(item);
            
            if (!shouldKeep && item.blob) {
                try {
                    URL.revokeObjectURL(URL.createObjectURL(item.blob));
                    console.log(`[V7] Manual cleanup: removed ${item.name}`);
                } catch (error) {
                    console.warn(`[V7] Failed to revoke blob URL during manual cleanup: ${item.name}`, error);
                }
            }
            
            return shouldKeep;
        });

        const cleanedCount = beforeCount - this.queues.length;
        
        if (cleanedCount > 0) {
            this.saveToStorage();
            this.render();
            console.log(`[V7] Manual cleanup: removed ${cleanedCount} video(s) from cache`);
        }

        return cleanedCount;
    }

    // Helper method to calculate time ago
    getTimeAgo(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    }

    // Helper method to check if video will cleanup soon (within 15 minutes)
    willCleanupSoon(dateString) {
        if (!dateString) return false;
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        // Will cleanup in 15 minutes (45 minutes old, since cleanup happens at 60 minutes)
        return diffMins >= 45;
    }

    addToQueue(url, name) {
        const existingItem = this.queues.find(item => item.url === url);
        if (existingItem) {
            return; // Already in queue
        }

        const item = {
            id: Date.now().toString(),
            url,
            name,
            status: 'pending',
            progress: 0,
            blob: null,
            error: null,
            addedAt: new Date().toISOString()
        };

        this.queues.push(item);
        this.saveToStorage();
        this.render();
        this.processQueue();
    }

    processQueue() {
        const pendingItems = this.queues.filter(item => item.status === 'pending');
        
        pendingItems.forEach(item => {
            this.downloadFile(item);
        });
    }

    async downloadFile(item) {
        this.updateStatus(item.id, 'downloading', 0);

        try {
            // Check if URL is direct video file
            const url = new URL(item.url);
            const isDirectFile = /\.(mp4|mkv|avi|webm|m3u8)$/i.test(url.pathname);

            if (!isDirectFile) {
                // For non-direct URLs (Google Drive, Mega, etc), open in new tab instead
                throw new Error('Link ini harus dibuka di browser. Klik link untuk download manual.');
            }

            const response = await fetch(item.url, {
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - Server tidak dapat diakses`);
            }

            const contentLength = response.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                loaded += value.length;

                if (total > 0) {
                    const progress = Math.round((loaded / total) * 100);
                    this.updateStatus(item.id, 'downloading', progress);
                }
            }

            const blob = new Blob(chunks, { type: 'video/mp4' });
            this.updateStatus(item.id, 'completed', 100, blob);

        } catch (error) {
            console.error('[V7] Download error:', error);

            // Provide helpful error message
            let errorMsg = error.message;
            if (error.message.includes('CORS') || error.message.includes('Network')) {
                errorMsg = 'CORS Error: Gunakan link eksternal untuk download';
            }

            this.updateStatus(item.id, 'error', 0, null, errorMsg);
        }
    }

    updateStatus(id, status, progress = 0, blob = null, error = null) {
        const item = this.queues.find(item => item.id === id);
        if (!item) return;

        item.status = status;
        item.progress = progress;
        if (blob) item.blob = blob;
        if (error) item.error = error;
        item.updatedAt = new Date().toISOString();

        this.saveToStorage();
        this.render();

        // Auto-play if this is the first completed video and no active video
        if (status === 'completed' && !appState.activeVideo) {
            this.playVideo(item);
        }
    }

    async playVideo(item) {
        if (!item.blob) {
            showError('Video belum selesai diunduh');
            return;
        }

        const videoUrl = URL.createObjectURL(item.blob);
        appState.activeVideo = item;

        const playerContainer = document.getElementById('videoPlayer');
        if (playerContainer) {
            playerContainer.innerHTML = `
                <video controls autoplay>
                    <source src="${videoUrl}" type="video/mp4">
                    Browser Anda tidak mendukung video player.
                </video>
            `;

            // Clean up blob URL when video ends
            const video = playerContainer.querySelector('video');
            if (video) {
                video.addEventListener('ended', () => {
                    URL.revokeObjectURL(videoUrl);
                    appState.activeVideo = null;
                });

                video.addEventListener('error', () => {
                    URL.revokeObjectURL(videoUrl);
                    appState.activeVideo = null;
                    showError('Gagal memutar video');
                });
            }
        }
    }

    

    render() {
        const container = document.getElementById('downloadQueue');
        if (!container) return;

        if (this.queues.length === 0) {
            container.innerHTML = '';
            return;
        }

        const activeDownloads = this.queues.filter(item => item.status === 'downloading');
        const completedDownloads = this.queues.filter(item => item.status === 'completed');

        container.innerHTML = `
            <div class="download-queue">
                <div class="queue-header">
                    <div>
                        <h3 class="queue-title">📥 Download Queue</h3>
                        <div class="queue-status">${activeDownloads.length} downloading, ${completedDownloads.length} completed</div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${completedDownloads.length > 0 ? 
                            `<button class="download-btn" onclick="appState.downloadQueue.manualCleanup()" style="background: var(--warning-color); color: #1a0a0f; border-color: var(--warning-color);">
                                🧹 Cleanup Old
                            </button>` : ''
                        }
                        <button class="download-btn" onclick="console.log('[V7] Cache info:', localStorage.getItem('v7_download_queue') ? JSON.parse(localStorage.getItem('v7_download_queue')).length : 0, 'videos')" style="background: rgba(255,255,255,0.1);">
                            📊 Info
                        </button>
                    </div>
                </div>
                ${this.queues.map(item => this.renderItem(item)).join('')}
            </div>
        `;
    }

    renderItem(item) {
        const statusClass = item.status;
        const statusIcon = {
            pending: '⏳',
            downloading: '⬇️',
            completed: '✅',
            error: '❌'
        }[item.status] || '⏳';

        // Calculate time ago for completed videos
        const timeAgo = item.status === 'completed' ? this.getTimeAgo(item.updatedAt || item.addedAt) : '';
        const willCleanupSoon = item.status === 'completed' && this.willCleanupSoon(item.updatedAt || item.addedAt);

        return `
            <div class="download-item ${willCleanupSoon ? 'cleanup-warning' : ''}">
                <div class="download-status ${statusClass}">${statusIcon}</div>
                <div class="download-info">
                    <div class="download-name">${escapeHtml(item.name)}</div>
                    ${item.status === 'completed' ?
                        `<div class="download-age">${timeAgo} ${willCleanupSoon ? '⏰ Will auto-cleanup soon' : ''}</div>` :
                        item.status === 'error' ?
                        `<div class="download-age" style="color: #e74c3c;">${escapeHtml(item.error || 'Download gagal')}</div>` :
                        `<div class="download-progress">
                            <div class="download-progress-bar">
                                <div class="download-progress-fill" style="width: ${item.progress}%"></div>
                            </div>
                            <span>${item.progress}%</span>
                        </div>`
                    }
                </div>
                <div class="download-actions">
                    ${item.status === 'completed' ?
                        `<button class="download-btn play-btn" onclick="appState.downloadQueue.playVideo(appState.downloadQueue.queues.find(i => i.id === '${item.id}'))">
                            ▶️ Play
                        </button>` : ''
                    }
                    <button class="download-btn" onclick="appState.downloadQueue.removeFromQueue('${item.id}')" ${item.status === 'downloading' ? 'disabled' : ''}>
                        ${item.status === 'downloading' ? '⏸️' : '🗑️'} ${item.status === 'downloading' ? 'Downloading...' : 'Remove'}
                    </button>
                </div>
            </div>
        `;
    }
}

async function testDownloadUrl(url, name) {
    try {
        showError('Testing URL: ' + name + '...');

        const response = await fetch('/api/v7/nekopoi/test-download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const result = await response.json();

        if (result.status === 'success') {
            const data = result.data;

            let message = `<h3>Test Results for: ${escapeHtml(name)}</h3>`;
            message += `<p><strong>URL:</strong> ${escapeHtml(url)}</p>`;
            message += `<p><strong>Can Download:</strong> ${data.canDownload ? '✅ YES' : '❌ NO'}</p>`;

            if (data.canDownload) {
                message += `<p><strong>Method:</strong> ${data.method}</p>`;
                message += `<p><strong>Content Type:</strong> ${data.contentType || 'Unknown'}</p>`;
                message += `<p><strong>Size:</strong> ${data.contentLength ? (parseInt(data.contentLength) / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'}</p>`;
                message += `<p style="margin-top: 16px;"><button class="host-btn" onclick="downloadViaProxy('${escapeHtml(url)}', '${escapeHtml(name)}')">📥 Download via Proxy</button></p>`;
            } else if (data.error) {
                message += `<p style="color: #e74c3c;"><strong>Error:</strong> ${data.error}</p>`;
            }

            message += `<details style="margin-top: 16px;"><summary style="cursor: pointer; font-weight: 600;">📋 Detailed Test Results</summary>`;
            message += `<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem;">${JSON.stringify(data.details, null, 2)}</pre>`;
            message += `</details>`;

            showError(message);
        } else {
            showError('Test failed: ' + result.message);
        }
    } catch (error) {
        console.error('[V7] Test error:', error);
        showError('Failed to test URL: ' + error.message);
    }
}

function downloadViaProxy(url, name) {
    const proxyUrl = `/api/v7/nekopoi/proxy-download?url=${encodeURIComponent(url)}`;

    // Try to download via proxy
    if (!appState.downloadQueue) {
        appState.downloadQueue = new DownloadQueue();
    }

    appState.downloadQueue.addToQueue(proxyUrl, name);
    hideError();
}

function downloadVideo(url, name) {
    if (!appState.downloadQueue) {
        appState.downloadQueue = new DownloadQueue();
    }

    appState.downloadQueue.addToQueue(url, name);
}

function loadDownloadQueue() {
    appState.downloadQueue = new DownloadQueue();
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
