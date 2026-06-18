// Episode Player V3 - Kuramanime
function enc(value) {
    return encodeURIComponent(String(value ?? ''));
}

function safeUrl(value, fallback = '#') {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;

    try {
        const url = new URL(raw, window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
    } catch {
        return fallback;
    }
}

function buildEpisodePageUrl(animeId, slug, episode) {
    return `/v3/episode?animeId=${enc(animeId)}&slug=${enc(slug)}&episode=${enc(episode)}`;
}

function buildDetailPageUrl(animeId, slug) {
    return `/v3/detail?animeId=${enc(animeId)}&slug=${enc(slug)}`;
}

function toMediaProxyUrl(url, referer = 'https://v18.kuramanime.ing/') {
    const safeSourceUrl = safeUrl(url, '');
    if (!safeSourceUrl) return '';
    return `/api/media-proxy?url=${enc(safeSourceUrl)}&referer=${enc(referer)}`;
}

let episodeData = null;
let currentServer = null;
let currentQuality = null;
let playerSettings = null;
let currentEpisodeId = null;
let hlsInstance = null; // HLS.js instance for HLS streaming
let currentHLSSession = null; // Current HLS conversion session (primary quality)
let allHLSSessions = []; // All HLS sessions (all qualities) for cleanup
let qualitySessionMap = new Map(); // Map quality -> sessionData for switching
let availableQualities = []; // Available qualities from sources
let youtubePlayer = null; // YouTube-style player instance

// Get URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const animeId = params.get('animeId');
    const slug = params.get('slug');
    const episode = params.get('episode');

    const isValidAnimeId = /^\d{1,20}$/.test(animeId || '');
    const isValidEpisode = /^\d{1,6}$/.test(episode || '');
    const isValidSlug = typeof slug === 'string' &&
        slug.length >= 1 &&
        slug.length <= 200 &&
        !slug.includes('/') &&
        !slug.includes('\\') &&
        !/[\x00-\x1F\x7F]/.test(slug);

    if (!isValidAnimeId || !isValidSlug || !isValidEpisode) {
        return null;
    }

    return { animeId, slug, episode };
}

// Fetch episode data from API
async function fetchEpisodeData() {
    const params = getUrlParams();
    if (!params) {
        showError('Parameter episode tidak valid atau tidak lengkap.');
        return;
    }

    const { animeId, slug, episode } = params;
    const apiUrl = `/api/v3/kuramanime/episode/${enc(animeId)}/${enc(slug)}/${enc(episode)}`;

    // Load player settings
    if (typeof PlayerConfig !== 'undefined') {
        playerSettings = PlayerConfig.loadSettings();
        console.log('Player settings loaded:', playerSettings);
    }

    // Set current episode ID for resume functionality
    currentEpisodeId = `v3-${animeId}-${slug}-ep${episode}`;

    try {
        const response = await fetch(apiUrl);
        const result = await response.json();

        if (result.status === 'success') {
            episodeData = result.data;
            renderPage();
        } else {
            showError('Failed to load episode data');
        }
    } catch (error) {
        console.error('Error fetching episode:', error);
        showError('Network error. Please try again.');
    }
}

// Render the entire page
function renderPage() {
    if (!episodeData) return;

    // Update header
    document.getElementById('episodeTitle').textContent = episodeData.title;
    document.getElementById('animeTitle').textContent = episodeData.anime_title;
    document.getElementById('episodeNum').textContent = episodeData.episode;

    // Update page title
    document.title = `${episodeData.anime_title} Episode ${episodeData.episode}`;

    // Render episode list
    renderEpisodeList();

    // Render download links
    renderDownloadLinks();

    // Setup navigation
    setupNavigation();

    // Load default server (kuramadrive HLS)
    const defaultServer = episodeData.streaming_servers.find(s => s.selected) ||
        episodeData.streaming_servers[0];
    if (defaultServer) {
        loadServer(defaultServer.value);
    }
}

// Server selector removed - using kuramadrive HLS by default

// Load server and video sources
function loadServer(serverValue) {
    console.log('Loading server:', serverValue);

    // Cleanup HLS instance and all sessions when switching servers
    cleanupHLS();
    cleanupAllHLSSessions();

    const server = episodeData.streaming_servers.find(s => s.value === serverValue);

    if (!server) {
        console.error('Server not found:', serverValue);
        return;
    }

    console.log('Server found:', server.name);
    console.log('Server has sources:', server.sources ? server.sources.length : 0);

    currentServer = server;

    // Show loading
    showLoading();

    // Check if server has sources
    if (!server.sources || server.sources.length === 0) {
        console.error('No sources for server:', server.name);
        showError('No sources available for this server');
        return;
    }

    const sources = server.sources;
    console.log('Sources:', sources.map(s => s.quality).join(', '));

    // Check if it's Kuramadrive - use direct video by default, HLS only as fallback
    if (isKuramadrive(server.name)) {
        console.log('Detected Kuramadrive server, loading direct video first...');
        availableQualities = sources.map(s => s.quality);
        renderQualitySelector(sources);
        loadVideo(sources);

        return;
    }

    // Check if it's iframe or direct video
    if (sources[0].quality === 'iframe') {
        console.log('Loading iframe for:', server.name);
        loadIframe(sources[0].url);
        hideQualitySelector();
    } else {
        // Load direct video with all qualities
        console.log('Loading direct video with quality selector');
        renderQualitySelector(sources);
        loadVideo(sources);
    }
}

// Render quality selector for direct video
function renderQualitySelector(sources) {
    const qualityControl = document.getElementById('qualityControl');
    const qualitySelect = document.getElementById('qualitySelect');

    qualitySelect.innerHTML = '';

    console.log('Rendering quality selector with sources:', sources.length);

    sources.forEach((source, index) => {
        const option = document.createElement('option');
        option.value = source.quality;
        option.textContent = `${source.quality} (${source.type.includes('mp4') ? 'MP4' : 'Video'})`;
        qualitySelect.appendChild(option);
        console.log(`  Quality ${index + 1}: ${source.quality}`);
    });

    // Select lowest quality by default (360p) for fast loading
    // Higher qualities will be available in selector
    if (sources.length > 0) {
        qualitySelect.value = sources[0].quality;
        currentQuality = sources[0].quality;
        console.log('Selected default quality (lowest for fast loading):', currentQuality);
    }

    // Show quality control
    qualityControl.style.display = 'flex';
    console.log('Quality control displayed:', qualityControl.style.display);
    console.log('Quality select options count:', qualitySelect.options.length);

    // Log all quality options
    for (let i = 0; i < qualitySelect.options.length; i++) {
        console.log(`  Quality option ${i}: ${qualitySelect.options[i].text}`);
    }

    // Remove old listeners by cloning (includes all child options)
    const newSelect = qualitySelect.cloneNode(true);
    qualityControl.replaceChild(newSelect, qualitySelect);

    newSelect.addEventListener('change', (e) => {
        currentQuality = e.target.value;
        console.log('Quality changed to:', currentQuality);
        const currentTime = getCurrentVideoTime();
        loadVideo(sources, currentTime);
    });
}

// Setup Kuramadrive quality menu in YouTube player UI
function setupKuramaDriveQualityMenu(sources) {
    if (!youtubePlayer) {
        console.error('YouTube player not initialized');
        return;
    }

    console.log('Setting up Kuramadrive quality menu in YouTube player UI');
    console.log('Available qualities:', sources.map(s => s.quality).join(', '));

    // Build quality options array with status
    const qualityOptions = sources.map((source, index) => ({
        quality: source.quality,
        ready: index === 0, // First is ready, others converting
        label: index === 0 ? `${source.quality} ✓` : `${source.quality} (converting...)`
    }));

    // Store quality options for updates
    window.kuramaDriveQualityOptions = qualityOptions;

    // Set custom quality menu callback
    youtubePlayer.onQualityMenuClick = () => {
        console.log('Quality menu clicked in YouTube player');

        // Use updated quality options from window (not the closure variable)
        const currentOptions = window.kuramaDriveQualityOptions || qualityOptions;

        // Build quality list with current status
        const qualityLabels = currentOptions.map(opt => opt.label);

        console.log('Showing quality options:', qualityLabels);

        // Show YouTube player quality menu
        youtubePlayer.showOptionsMenu('Quality', qualityLabels, (selectedLabel) => {
            // Find quality from label (use currentOptions for matching)
            const selected = currentOptions.find(opt => opt.label === selectedLabel);
            if (!selected) {
                console.error('Selected quality not found:', selectedLabel);
                return;
            }

            const quality = selected.quality;
            console.log('User selected quality from YouTube menu:', quality, 'Ready:', selected.ready);

            if (selected.ready) {
                // Quality is ready, switch now
                switchKuramaDriveQuality(quality);
            } else {
                // Quality not ready yet
                showError(`Quality ${quality} sedang di-convert. Mohon tunggu...`);
            }
        });
    };

    // Update quality value in YouTube player
    youtubePlayer.elements.qualityValue.textContent = sources[0].quality;

    // Hide old dropdown quality selector (we're using YouTube player UI now)
    const qualityControl = document.getElementById('qualityControl');
    if (qualityControl) {
        qualityControl.style.display = 'none';
        console.log('Dropdown quality selector hidden (using YouTube player UI)');
    }

    console.log('YouTube player quality menu configured');
}

async function fallbackToKuramaDriveHLS(sources, startTime = 0) {
    if (!Array.isArray(sources) || sources.length === 0) {
        showError('Tidak ada source video yang bisa dipakai untuk fallback HLS.');
        return;
    }

    console.warn('Direct playback failed, falling back to HLS conversion...');
    showConversionLoading();

    availableQualities = sources.map(s => s.quality);

    const lowestQuality = sources[0];

    try {
        const sessionData = await requestHLSConversion(lowestQuality.url, currentEpisodeId, lowestQuality.quality);
        currentHLSSession = sessionData;
        allHLSSessions.push(sessionData.sessionId);
        qualitySessionMap.set(lowestQuality.quality, sessionData);
        currentQuality = lowestQuality.quality;

        loadVideoWithHLS(sessionData.playlistUrl, startTime);

        setTimeout(() => {
            setupKuramaDriveQualityMenu(sources);
        }, 500);

        if (sources.length > 1) {
            sources.slice(1).forEach((source, index) => {
                setTimeout(() => {
                    requestHLSConversion(source.url, currentEpisodeId, source.quality)
                        .then(data => {
                            allHLSSessions.push(data.sessionId);
                            qualitySessionMap.set(source.quality, data);
                            updateQualityOption(source.quality, true);
                        })
                        .catch(err => {
                            console.warn(`HLS fallback failed for ${source.quality}:`, err.message);
                            updateQualityOption(source.quality, false);
                        });
                }, index * 5000);
            });
        }
    } catch (error) {
        console.error('HLS fallback failed:', error);
        showError('Direct video dan fallback HLS sama-sama gagal. Silakan coba server lain atau refresh halaman.');
    }
}

// Update quality option status (converting -> ready)
function updateQualityOption(quality, isReady) {
    console.log(`Updating quality option: ${quality} - Ready:`, isReady);

    // Update YouTube player quality options array
    if (window.kuramaDriveQualityOptions) {
        const option = window.kuramaDriveQualityOptions.find(opt => opt.quality === quality);
        if (option) {
            if (isReady === null) {
                option.ready = false;
                option.label = `${quality} (converting...)`;
            } else {
                option.ready = isReady;
                option.label = isReady ? `${quality} ✓` : `${quality} (failed)`;
            }
            console.log(`YouTube player quality option updated: ${quality} - ${option.label}`);
        }
    }

    // Also update dropdown select if it exists (legacy support)
    const qualitySelect = document.getElementById('qualitySelect');
    if (qualitySelect) {
        const selectOption = qualitySelect.querySelector(`option[data-quality="${quality}"]`);
        if (selectOption) {
            if (isReady === null) {
                selectOption.textContent = `${quality} (converting...)`;
                selectOption.dataset.ready = 'false';
                selectOption.disabled = true;
            } else if (isReady) {
                selectOption.textContent = `${quality} ✓`;
                selectOption.dataset.ready = 'true';
                selectOption.disabled = false;
            } else {
                selectOption.textContent = `${quality} (failed)`;
                selectOption.dataset.ready = 'false';
                selectOption.disabled = true;
            }
        }
    }
}

// Switch to different quality for Kuramadrive
function switchKuramaDriveQuality(quality) {
    console.log('=== switchKuramaDriveQuality called ===');
    console.log('Requested quality:', quality);
    console.log('Current quality:', currentQuality);
    console.log('Available sessions:', Array.from(qualitySessionMap.keys()));

    // Don't switch if already on this quality
    if (quality === currentQuality) {
        console.log('Already on this quality, skipping switch');
        return;
    }

    // Check if quality is ready
    const sessionData = qualitySessionMap.get(quality);
    console.log('Session data for', quality, ':', sessionData ? 'FOUND' : 'NOT FOUND');

    if (!sessionData) {
        console.warn('Quality not ready yet:', quality);
        console.log('Available qualities in map:', Array.from(qualitySessionMap.entries()));
        showError(`Quality ${quality} sedang di-convert. Mohon tunggu...`);

        // Revert selector to current quality
        const qualitySelect = document.getElementById('qualitySelect');
        if (qualitySelect) {
            qualitySelect.value = currentQuality;
            console.log('Reverted selector to:', currentQuality);
        }
        return;
    }

    // Get current time to resume playback
    const currentTime = getCurrentVideoTime();
    console.log('Current playback time:', currentTime, 'seconds');

    // Update current quality
    const oldQuality = currentQuality;
    currentQuality = quality;
    currentHLSSession = sessionData;
    console.log('Quality switched from', oldQuality, 'to', quality);

    // Update YouTube player quality display
    if (youtubePlayer && youtubePlayer.elements) {
        youtubePlayer.elements.qualityValue.textContent = quality;
        console.log('Updated YouTube player quality value to:', quality);

        // Update quality badge
        if (youtubePlayer.elements.qualityBadge) {
            youtubePlayer.elements.qualityBadge.style.display = '';
            youtubePlayer.elements.qualityBadge.textContent = quality.toUpperCase();
            console.log('Updated quality badge to:', quality.toUpperCase());
        }

        // Show notification
        youtubePlayer.showNotification(`Quality: ${quality}`);
    } else {
        console.warn('YouTube player not available for UI update');
    }

    // Load HLS with new quality
    console.log('Loading HLS with new quality');
    console.log('  Quality:', quality);
    console.log('  Session ID:', sessionData.sessionId);
    console.log('  Playlist URL:', sessionData.playlistUrl);
    console.log('  Resume time:', currentTime);

    loadVideoWithHLS(sessionData.playlistUrl, currentTime);

    // Re-setup quality menu callback after new YouTube player is created
    setTimeout(() => {
        reattachKuramaDriveQualityMenu();
    }, 500);

    console.log('=== Quality switch complete ===');
}
// Re-attach Kuramadrive quality menu to new YouTube player after quality switch
function reattachKuramaDriveQualityMenu() {
    if (!youtubePlayer || !window.kuramaDriveQualityOptions) {
        console.warn('Cannot reattach quality menu - player or options not available');
        return;
    }

    console.log('Re-attaching Kuramadrive quality menu to new YouTube player');

    // Set custom quality menu callback
    youtubePlayer.onQualityMenuClick = () => {
        console.log('Quality menu clicked in YouTube player (reattached)');

        // Use updated quality options from window
        const currentOptions = window.kuramaDriveQualityOptions;

        // Build quality list with current status
        const qualityLabels = currentOptions.map(opt => opt.label);

        console.log('Showing quality options:', qualityLabels);

        // Show YouTube player quality menu
        youtubePlayer.showOptionsMenu('Quality', qualityLabels, (selectedLabel) => {
            // Find quality from label
            const selected = currentOptions.find(opt => opt.label === selectedLabel);
            if (!selected) {
                console.error('Selected quality not found:', selectedLabel);
                return;
            }

            const quality = selected.quality;
            console.log('User selected quality from YouTube menu:', quality, 'Ready:', selected.ready);

            if (selected.ready) {
                // Quality is ready, switch now
                switchKuramaDriveQuality(quality);
            } else {
                // Quality not ready yet
                showError(`Quality ${quality} sedang di-convert. Mohon tunggu...`);
            }
        });
    };

    // Update quality value in YouTube player
    youtubePlayer.elements.qualityValue.textContent = currentQuality;

    // Update quality badge
    if (youtubePlayer.elements.qualityBadge) {
        youtubePlayer.elements.qualityBadge.style.display = '';
        youtubePlayer.elements.qualityBadge.textContent = currentQuality.toUpperCase();
    }

    console.log('Kuramadrive quality menu reattached');
}

// Setup direct MP4/proxied MP4 quality menu in YouTube player UI
function setupDirectVideoQualityMenu(sources) {
    if (!youtubePlayer || !Array.isArray(sources) || sources.length === 0) {
        return;
    }

    const qualityOptions = sources.map((source) => source.quality).filter(Boolean);
    youtubePlayer.onQualityMenuClick = () => {
        youtubePlayer.showOptionsMenu('Quality', qualityOptions, (selectedQuality) => {
            if (!selectedQuality || selectedQuality === currentQuality) return;

            const currentTime = getCurrentVideoTime();
            currentQuality = selectedQuality;
            loadVideo(sources, currentTime);
        });
    };

    if (youtubePlayer.elements?.qualityValue) {
        youtubePlayer.elements.qualityValue.textContent = currentQuality || qualityOptions[0] || 'Auto';
    }

    if (youtubePlayer.elements?.qualityBadge && currentQuality) {
        youtubePlayer.elements.qualityBadge.style.display = '';
        youtubePlayer.elements.qualityBadge.textContent = currentQuality.toUpperCase();
    }

    const qualityControl = document.getElementById('qualityControl');
    if (qualityControl) {
        qualityControl.style.display = 'none';
    }
}

// Hide quality selector
function hideQualitySelector() {
    document.getElementById('qualityControl').style.display = 'none';
}

// Get current video time
function getCurrentVideoTime() {
    const video = document.querySelector('#videoContainer video');
    return video ? video.currentTime : 0;
}

// Check if URL is HLS stream
function isHLSStream(url) {
    return url && (url.includes('.m3u8') || url.toLowerCase().endsWith('.m3u8'));
}

// Check if server is Kuramadrive
function isKuramadrive(serverName) {
    return serverName && serverName.toLowerCase().includes('kuramadrive');
}

// Request HLS conversion from server
async function requestHLSConversion(videoUrl, episodeId, quality = 'auto') {
    console.log('Requesting HLS conversion for:', videoUrl, 'Quality:', quality);

    try {
        const response = await fetch('/api/hls/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoUrl: videoUrl,
                episodeId: episodeId,
                quality: quality
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            console.log('HLS conversion successful:', result.data);
            return result.data;
        } else {
            throw new Error(result.message || 'Conversion failed');
        }
    } catch (error) {
        console.error('HLS conversion request failed:', error);
        throw error;
    }
}

// Close HLS session
async function closeHLSSession(sessionId) {
    if (!sessionId) return;

    console.log('Closing HLS session:', sessionId);

    try {
        const response = await fetch(`/api/hls/close/${sessionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('Session closed:', result);
    } catch (error) {
        console.error('Error closing session:', error);
    }
}

// Close all HLS sessions (all qualities)
async function cleanupAllHLSSessions() {
    if (allHLSSessions.length === 0) return;

    console.log('Cleaning up all HLS sessions:', allHLSSessions.length, 'session(s)');

    // Close all sessions
    const closePromises = allHLSSessions.map(sessionId => closeHLSSession(sessionId));
    await Promise.all(closePromises);

    // Clear all data structures
    allHLSSessions = [];
    currentHLSSession = null;
    qualitySessionMap.clear();
    availableQualities = [];

    // Clear Kuramadrive quality options
    if (window.kuramaDriveQualityOptions) {
        delete window.kuramaDriveQualityOptions;
    }

    // Reset YouTube player quality callback
    if (youtubePlayer) {
        youtubePlayer.onQualityMenuClick = null;
    }

    console.log('All HLS sessions cleaned up');
}

// Initialize YouTube Player
function initializeYouTubePlayer(videoElement, containerElement) {
    try {
        // Destroy existing player
        if (youtubePlayer) {
            youtubePlayer.destroy();
            youtubePlayer = null;
        }

        // Check if YouTubePlayer class is available
        if (typeof YouTubePlayer === 'undefined') {
            console.warn('YouTube Player not loaded, using native controls');
            videoElement.controls = true;
            return;
        }

        // Create new YouTube player
        youtubePlayer = new YouTubePlayer(containerElement, videoElement);

        // Show skip buttons if enabled in settings


        // Set quality badge if available
        if (currentQuality && currentQuality !== 'auto') {
            const badge = containerElement.querySelector('[data-quality-badge]');
            if (badge) {
                badge.style.display = '';
                badge.textContent = currentQuality.toUpperCase();
            }
        }

        console.log('✨ YouTube Player initialized successfully!');
    } catch (error) {
        console.error('Error initializing YouTube Player:', error);
        // Fallback to native controls
        videoElement.controls = true;
    }
}

// Cleanup HLS instance
function cleanupHLS() {
    if (hlsInstance) {
        console.log('Cleaning up HLS instance');
        hlsInstance.destroy();
        hlsInstance = null;
    }
}

// Setup YouTube Player quality integration with HLS
function setupYouTubePlayerQuality(levels, hls) {
    console.log('Setting up YouTube Player quality integration with HLS');

    // Sort levels by height (low to high)
    const sortedLevels = levels
        .map((level, originalIndex) => ({ ...level, originalIndex }))
        .sort((a, b) => a.height - b.height);

    // Create quality options (Auto + all available levels)
    const qualityOptions = ['Auto', ...sortedLevels.map(l => `${l.height}p`)];

    // Get default quality from settings
    const defaultQuality = playerSettings?.defaultQuality || 'auto';

    // Set current quality in YouTube player
    if (defaultQuality === 'auto') {
        youtubePlayer.setQuality('Auto');
    } else {
        const matchingLevel = sortedLevels.find(l => l.height === parseInt(defaultQuality));
        if (matchingLevel) {
            youtubePlayer.setQuality(`${matchingLevel.height}p`);
            hls.currentLevel = matchingLevel.originalIndex;
        }
    }

    // Set up quality menu click handler
    youtubePlayer.onQualityMenuClick = () => {
        youtubePlayer.showOptionsMenu('Quality', qualityOptions, (selectedQuality, index) => {
            if (index === 0) {
                // Auto quality
                hls.currentLevel = -1;
                youtubePlayer.setQuality('Auto');
                console.log('HLS quality: Auto (Adaptive)');

                // Save preference
                if (typeof PlayerConfig !== 'undefined') {
                    const settings = PlayerConfig.loadSettings();
                    settings.defaultQuality = 'auto';
                    PlayerConfig.saveSettings(settings);
                }
            } else {
                // Manual quality - index-1 because Auto is first
                const level = sortedLevels[index - 1];
                hls.currentLevel = level.originalIndex;
                youtubePlayer.setQuality(`${level.height}p`);
                console.log(`HLS quality switched to: ${level.height}p - ${Math.round(level.bitrate / 1000)} kbps`);

                // Save preference
                if (typeof PlayerConfig !== 'undefined') {
                    const settings = PlayerConfig.loadSettings();
                    settings.defaultQuality = level.height;
                    PlayerConfig.saveSettings(settings);
                    console.log(`Quality preference saved: ${level.height}p`);
                }
            }
        });
    };

    console.log('YouTube Player quality integration complete');
}

// Setup HLS quality selector
function setupHLSQualitySelector(levels, hls) {
    // If YouTube player is available, integrate with it
    if (youtubePlayer) {
        setupYouTubePlayerQuality(levels, hls);
        return;
    }

    // Fallback to old dropdown method
    const qualityControl = document.getElementById('qualityControl');
    const qualitySelect = document.getElementById('qualitySelect');

    if (!qualityControl || !qualitySelect) return;

    // Clear existing options
    qualitySelect.innerHTML = '';

    // Sort levels by height (low to high)
    const sortedLevels = levels
        .map((level, index) => ({ ...level, originalIndex: index }))
        .sort((a, b) => (a.height || 0) - (b.height || 0));

    // Add auto option first
    const autoOption = document.createElement('option');
    autoOption.value = '-1';
    autoOption.textContent = 'Auto (Adaptive) ✨';
    qualitySelect.appendChild(autoOption);

    // Add manual quality options (sorted low to high)
    sortedLevels.forEach((level) => {
        const option = document.createElement('option');
        option.value = level.originalIndex;
        const height = level.height || 'Unknown';
        const bitrate = Math.round(level.bitrate / 1000);
        option.textContent = `${height}p - ${bitrate} kbps`;
        qualitySelect.appendChild(option);
    });

    // Check for default quality preference from settings
    let defaultQuality = playerSettings?.defaultQuality || 'auto';

    // Set default selection
    if (defaultQuality === 'auto') {
        qualitySelect.value = '-1';
        hls.currentLevel = -1;
    } else {
        // Find matching quality level
        const targetHeight = parseInt(defaultQuality); // e.g., 480 from "480p"
        const matchingLevel = sortedLevels.find(l => l.height === targetHeight);

        if (matchingLevel) {
            qualitySelect.value = matchingLevel.originalIndex;
            hls.currentLevel = matchingLevel.originalIndex;
            console.log(`Starting with preferred quality: ${targetHeight}p`);
        } else {
            qualitySelect.value = '-1';
            hls.currentLevel = -1;
        }
    }

    // Show quality control
    qualityControl.style.display = 'flex';

    // Handle quality change
    qualitySelect.addEventListener('change', (e) => {
        const levelIndex = parseInt(e.target.value);

        if (levelIndex === -1) {
            // Enable auto quality switching
            hls.currentLevel = -1;
            console.log('HLS quality: Auto (Adaptive)');

            // Save preference
            if (typeof PlayerConfig !== 'undefined') {
                const settings = PlayerConfig.loadSettings();
                settings.defaultQuality = 'auto';
                PlayerConfig.saveSettings(settings);
            }
        } else {
            // Set manual quality
            hls.currentLevel = levelIndex;
            const selectedLevel = levels[levelIndex];
            const quality = `${selectedLevel.height}p - ${Math.round(selectedLevel.bitrate / 1000)} kbps`;
            console.log(`HLS quality switched to: ${quality}`);

            // Save preference
            if (typeof PlayerConfig !== 'undefined') {
                const settings = PlayerConfig.loadSettings();
                settings.defaultQuality = selectedLevel.height;
                PlayerConfig.saveSettings(settings);
                console.log(`Quality preference saved: ${selectedLevel.height}p`);
            }

            // Show notification
            showQualityChangeNotification(quality);
        }
    });

    // Add current quality indicator
    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const currentLevel = levels[data.level];
        const quality = currentLevel.height ? `${currentLevel.height}p` : 'Unknown';
        console.log(`Playing at: ${quality} (${Math.round(currentLevel.bitrate / 1000)} kbps)`);
    });

    console.log('HLS quality selector setup complete with', levels.length, 'levels');
}

// Load video with HLS.js for HLS streams
function loadVideoWithHLS(url, startTime = 0) {
    console.log('Loading HLS stream:', url);
    console.log('Start time:', startTime);

    const container = document.getElementById('videoContainer');

    // Cleanup existing HLS instance
    cleanupHLS();

    // Clear container completely (removes conversion loading)
    container.innerHTML = '';

    // Create video element
    const video = document.createElement('video');
    video.controls = true;
    video.controlsList = 'nodownload';
    video.playsInline = true;
    video.preload = 'metadata';
    video.style.width = '100%';
    video.style.height = '100%';

    container.appendChild(video);

    // Initialize YouTube Player (handles all controls, overlays, etc.)
    initializeYouTubePlayer(video, container);

    // Check if HLS is supported
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        console.log('HLS.js is supported, initializing...');

        // Create HLS instance with config
        hlsInstance = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
        });

        const safeHlsSourceUrl = safeUrl(url, '');
        if (!safeHlsSourceUrl) {
            showError('Invalid HLS URL.');
            return;
        }

        // Load source
        hlsInstance.loadSource(safeHlsSourceUrl);
        hlsInstance.attachMedia(video);

        // HLS events
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log('HLS manifest loaded, found', data.levels.length, 'quality levels');

            // Log available qualities
            data.levels.forEach((level, index) => {
                console.log(`  Level ${index}: ${level.height}p - ${Math.round(level.bitrate / 1000)} kbps`);
            });

            // Add quality selector if multiple levels available
            // BUT skip if we're using Kuramadrive quality selector (multi-quality HLS)
            const hasKuramaDriveSelector = availableQualities.length > 0;
            if (data.levels.length > 1 && !hasKuramaDriveSelector) {
                console.log('Setting up HLS internal quality selector');
                setupHLSQualitySelector(data.levels, hlsInstance);
            } else if (hasKuramaDriveSelector) {
                console.log('Skipping HLS internal quality selector - using Kuramadrive multi-quality selector');
            }

            console.log('HLS ready, video should start playing...');
            // YouTube player handles loading states automatically

            // Set start time if provided
            if (startTime > 0) {
                video.currentTime = startTime;
                console.log('Set video time to:', startTime);
            }
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Fatal network error, trying to recover...');
                        hlsInstance.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Fatal media error, trying to recover...');
                        hlsInstance.recoverMediaError();
                        break;
                    default:
                        console.error('Fatal error, cannot recover');
                        cleanupHLS();
                        showError('Failed to load HLS stream. Try another server.');
                        break;
                }
            }
        });

        hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log('Quality switched to level', data.level);
        });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari, iOS)
        console.log('Using native HLS support');
        const safeHlsUrl = safeUrl(url, '');
        if (!safeHlsUrl) {
            showError('Invalid HLS URL.');
            return;
        }
        video.src = safeHlsUrl;

        video.addEventListener('loadedmetadata', () => {
            console.log('Video metadata loaded (native HLS)');
            // YouTube player handles loading states

            if (startTime > 0) {
                video.currentTime = startTime;
                console.log('Set video time to:', startTime);
            }
        });
    } else {
        console.error('HLS is not supported in this browser');
        showError('HLS streaming is not supported in this browser. Please try another browser or server.');
        return;
    }

    // Apply playback speed options from settings
    if (playerSettings?.playbackSpeeds && playerSettings.playbackSpeeds.length > 0) {
        const speedControl = document.getElementById('speedControl');
        const speedSelect = document.getElementById('speedSelect');

        if (speedControl && speedSelect) {
            speedSelect.innerHTML = '';

            playerSettings.playbackSpeeds.forEach(speed => {
                const option = document.createElement('option');
                option.value = speed;
                option.textContent = `${speed}x`;
                if (speed === 1.0) {
                    option.selected = true;
                }
                speedSelect.appendChild(option);
            });

            speedControl.style.display = 'flex';

            speedSelect.addEventListener('change', (e) => {
                const speed = parseFloat(e.target.value);
                video.playbackRate = speed;
                console.log('Playback speed changed to:', speed);
            });
        }
    }

    // Save resume position periodically
    if (playerSettings?.resumable && typeof PlayerConfig !== 'undefined' && currentEpisodeId) {
        video.addEventListener('timeupdate', () => {
            const currentTime = video.currentTime;
            const duration = video.duration;

            if (currentTime > 0 && duration - currentTime > 30 && Math.floor(currentTime) % 5 === 0) {
                PlayerConfig.saveResumePosition(currentEpisodeId, currentTime);
            }
        });

        video.addEventListener('ended', () => {
            PlayerConfig.saveResumePosition(currentEpisodeId, 0);
        });
    }

    // Handle errors
    video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        showError('Failed to load video. Try another server or quality.');
    });

    // Log when video starts playing
    video.addEventListener('playing', () => {
        console.log('HLS video is playing');
    });
}

// Load direct video
function loadVideo(sources, startTime = 0) {
    const container = document.getElementById('videoContainer');
    const shouldUseKuramaFallback = currentServer && isKuramadrive(currentServer.name);

    console.log('Loading video with', sources.length, 'sources');
    console.log('Start time:', startTime);

    // Cleanup any existing HLS instance first
    cleanupHLS();

    const validSources = sources.filter(source => safeUrl(source.url, ''));
    if (validSources.length === 0) {
        showError('No valid video sources available.');
        return;
    }

    // Check if this is an HLS stream (single source with .m3u8)
    if (validSources.length === 1 && isHLSStream(validSources[0].url)) {
        console.log('Detected HLS stream, using HLS player');
        loadVideoWithHLS(validSources[0].url, startTime);
        return;
    }

    // Store overlay elements
    const loadingOverlay = container.querySelector('.loading-overlay');
    const skipControls = container.querySelector('.video-skip-controls');
    const skipFeedback = container.querySelector('.skip-feedback');

    // Clear container
    container.innerHTML = '';

    // Create video element
    const video = document.createElement('video');
    video.controls = true;
    video.controlsList = 'nodownload';
    video.playsInline = true;
    video.preload = 'metadata';
    video.style.width = '100%';
    video.style.height = '100%';

    // Add sources - prioritize selected quality
    const selectedSource = validSources.find(s => s.quality === currentQuality) || validSources[0];
    const orderedSources = [
        selectedSource,
        ...validSources.filter((source) => source !== selectedSource)
    ];
    const shouldProxySource = shouldUseKuramaFallback;
    console.log('Selected quality source:', selectedSource.quality);

    // Add all sources to video element, with selected quality first.
    // Kuramadrive URLs are proxied through our same-origin range proxy because
    // upstream CORS only allows Kuramanime origins and can stop playback early.
    orderedSources.forEach((source, index) => {
        const sourceElement = document.createElement('source');
        const sourceUrl = shouldProxySource ? toMediaProxyUrl(source.url) : safeUrl(source.url, '');
        if (!sourceUrl) return;
        sourceElement.src = sourceUrl;
        sourceElement.type = source.type;
        sourceElement.setAttribute('size', source.quality.replace('p', ''));
        sourceElement.setAttribute('label', source.quality);
        video.appendChild(sourceElement);
        console.log(`  Source ${index + 1}: ${source.quality} - ${source.url.substring(0, 50)}...`);
    });

    container.appendChild(video);

    // Initialize YouTube Player
    initializeYouTubePlayer(video, container);
    setupDirectVideoQualityMenu(validSources);

    // Apply playback speed options from settings
    if (playerSettings?.playbackSpeeds && playerSettings.playbackSpeeds.length > 0) {
        const speedControl = document.getElementById('speedControl');
        const speedSelect = document.getElementById('speedSelect');

        if (speedControl && speedSelect) {
            // Clear existing options
            speedSelect.innerHTML = '';

            // Add speed options from settings
            playerSettings.playbackSpeeds.forEach(speed => {
                const option = document.createElement('option');
                option.value = speed;
                option.textContent = `${speed}x`;
                if (speed === 1.0) {
                    option.selected = true;
                }
                speedSelect.appendChild(option);
            });

            // Show speed control
            speedControl.style.display = 'flex';

            // Handle speed change
            speedSelect.addEventListener('change', (e) => {
                const speed = parseFloat(e.target.value);
                video.playbackRate = speed;
                console.log('Playback speed changed to:', speed);
            });

            console.log('Playback speeds loaded:', playerSettings.playbackSpeeds);
        }
    }

    // Set start time and play
    video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded');
        if (startTime > 0) {
            video.currentTime = startTime;
            console.log('Set video time to:', startTime);
        }
        hideLoading();
    });

    // Save resume position periodically
    if (playerSettings?.resumable && typeof PlayerConfig !== 'undefined' && currentEpisodeId) {
        video.addEventListener('timeupdate', () => {
            const currentTime = video.currentTime;
            const duration = video.duration;

            // Save position every 5 seconds, but not in last 30 seconds
            if (currentTime > 0 && duration - currentTime > 30 && Math.floor(currentTime) % 5 === 0) {
                PlayerConfig.saveResumePosition(currentEpisodeId, currentTime);
            }
        });

        // Clear resume position when video ends
        video.addEventListener('ended', () => {
            PlayerConfig.saveResumePosition(currentEpisodeId, 0);
        });
    }

    // Handle errors
    video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        if (shouldUseKuramaFallback && allHLSSessions.length === 0) {
            fallbackToKuramaDriveHLS(sources, startTime);
            return;
        }

        showError('Failed to load video. Try another server or quality.');
    });

    // Log when video starts playing
    video.addEventListener('playing', () => {
        console.log('Video is playing');
    });
}

// Load iframe
function loadIframe(url) {
    const container = document.getElementById('videoContainer');

    // Clear container except loading overlay
    const loadingOverlay = container.querySelector('.loading-overlay');
    const skipControls = container.querySelector('.video-skip-controls');
    const skipFeedback = container.querySelector('.skip-feedback');

    container.innerHTML = '';

    // Create iframe
    const iframe = document.createElement('iframe');
    const iframeUrl = safeUrl(url, '');
    if (!iframeUrl) {
        showError('Invalid iframe URL.');
        return;
    }
    iframe.src = iframeUrl;
    iframe.allowFullscreen = true;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

    container.appendChild(iframe);

    // Re-append overlay elements
    if (loadingOverlay) container.appendChild(loadingOverlay);
    if (skipControls) container.appendChild(skipControls);
    if (skipFeedback) container.appendChild(skipFeedback);

    // Hide loading after a delay
    setTimeout(() => hideLoading(), 1000);
}

// Show loading overlay
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    } else {
        const container = document.getElementById('videoContainer');
        const newOverlay = document.createElement('div');
        newOverlay.className = 'loading-overlay';
        newOverlay.id = 'loadingOverlay';
        newOverlay.innerHTML = '<div class="spinner"></div>';
        container.appendChild(newOverlay);
    }
}

// Show conversion loading with message
function showConversionLoading() {
    const container = document.getElementById('videoContainer');
    container.innerHTML = `
        <div class="loading-overlay" style="display: flex; flex-direction: column; gap: 15px;">
            <div class="spinner"></div>
            <div style="text-align: center; color: #fff;">
                <p style="font-size: 1.1rem; font-weight: 600; margin: 0;">Mengkonversi Video...</p>
                <p style="font-size: 0.85rem; color: #999; margin: 5px 0 0 0;">
                    Video sedang didownload dan dikonversi ke format HLS.<br>
                    Mohon tunggu beberapa saat...
                </p>
            </div>
        </div>
    `;
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        console.log('Hiding loading overlay');
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }
}

// Show error message
function showError(message) {
    const container = document.getElementById('videoContainer');
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'error-message';

    const title = document.createElement('h3');
    title.textContent = '⚠️ Error';

    const text = document.createElement('p');
    text.textContent = String(message || 'Terjadi kesalahan.');

    wrapper.appendChild(title);
    wrapper.appendChild(text);
    container.appendChild(wrapper);
}

// Render episode list
function renderEpisodeList() {
    const container = document.getElementById('episodeList');
    container.innerHTML = '';

    if (!episodeData.episode_list || episodeData.episode_list.length === 0) {
        container.innerHTML = '<div class="loading-message">No episodes available</div>';
        return;
    }

    episodeData.episode_list.forEach(ep => {
        const btn = document.createElement('button');
        btn.className = 'episode-btn';
        btn.textContent = `Ep ${ep.episode}`;

        if (ep.is_active) {
            btn.classList.add('active');
        }

        if (ep.is_new) {
            btn.classList.add('new');
        }

        btn.addEventListener('click', () => {
            navigateToEpisode(ep.url);
        });

        container.appendChild(btn);
    });
}

// Navigate to episode
function navigateToEpisode(url) {
    // Extract parameters from URL
    const match = url.match(/\/anime\/(\d+)\/([^\/]+)\/episode\/(\d+)/);
    if (match) {
        const [, animeId, slug, episode] = match;
        window.location.href = buildEpisodePageUrl(animeId, slug, episode);
    }
}

// Render download links
function renderDownloadLinks() {
    const container = document.getElementById('downloadContainer');
    container.innerHTML = '';

    if (!episodeData.download_links || episodeData.download_links.length === 0) {
        container.innerHTML = '<div class="loading-message">No download links available</div>';
        return;
    }

    // Group by quality
    const grouped = Object.create(null);
    episodeData.download_links.forEach(link => {
        const quality = String(link.quality || 'Unknown');
        if (!grouped[quality]) {
            grouped[quality] = [];
        }
        grouped[quality].push(link);
    });

    // Render each quality group
    Object.entries(grouped).forEach(([quality, links]) => {
        const qualityGroup = document.createElement('div');
        qualityGroup.className = 'quality-group';

        const header = document.createElement('h3');
        header.textContent = `${quality} (${links[0].size})`;
        qualityGroup.appendChild(header);

        const linksContainer = document.createElement('div');
        linksContainer.className = 'download-links';

        links.forEach(link => {
            const a = document.createElement('a');
            a.href = safeUrl(link.url, '#');
            a.className = 'download-btn';
            a.textContent = link.provider;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            linksContainer.appendChild(a);
        });

        qualityGroup.appendChild(linksContainer);
        container.appendChild(qualityGroup);
    });
}

// Setup navigation buttons
function setupNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const detailBtn = document.getElementById('detailBtn');

    // Previous episode
    if (episodeData.navigation.prev_episode) {
        prevBtn.classList.remove('disabled');
        prevBtn.href = convertToPlayerUrl(episodeData.navigation.prev_episode);
    } else {
        prevBtn.classList.add('disabled');
        prevBtn.onclick = (e) => e.preventDefault();
    }

    // Next episode
    if (episodeData.navigation.next_episode) {
        nextBtn.classList.remove('disabled');
        nextBtn.href = convertToPlayerUrl(episodeData.navigation.next_episode);
    } else {
        nextBtn.classList.add('disabled');
        nextBtn.onclick = (e) => e.preventDefault();
    }

    // Detail page - convert to internal detail page
    if (episodeData.anime_detail_url) {
        const detailUrl = convertToDetailUrl(episodeData.anime_detail_url);
        detailBtn.href = detailUrl;
        detailBtn.removeAttribute('target'); // Open in same tab
    }
}

// Convert original URL to player URL
function convertToPlayerUrl(url) {
    const match = url.match(/\/anime\/(\d+)\/([^\/]+)\/episode\/(\d+)/);
    if (match) {
        const [, animeId, slug, episode] = match;
        return buildEpisodePageUrl(animeId, slug, episode);
    }
    return safeUrl(url, '#');
}

// Convert original URL to detail page URL
function convertToDetailUrl(url) {
    // Match pattern: /anime/{animeId}/{slug}
    const match = url.match(/\/anime\/(\d+)\/([^\/\?]+)/);
    if (match) {
        const [, animeId, slug] = match;
        return buildDetailPageUrl(animeId, slug);
    }
    return safeUrl(url, '#');
}

// Skip video functions
function skipVideo(seconds) {
    const video = document.querySelector('#videoContainer video');
    if (!video) return;

    const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    video.currentTime = newTime;

    // Show feedback
    showSkipFeedback(seconds);
}

function showSkipFeedback(seconds) {
    const feedback = document.getElementById('skipFeedback');
    if (!feedback) return;

    const direction = seconds > 0 ? 'forward' : 'backward';
    const absSeconds = Math.abs(seconds);
    const arrow = seconds > 0 ? '→' : '←';

    feedback.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
            ${seconds > 0 ?
            '<path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>' :
            '<path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>'
        }
        </svg>
        ${absSeconds} detik ${arrow}
    `;

    feedback.classList.add('show');

    setTimeout(() => {
        feedback.classList.remove('show');
    }, 800);
}

// Check if device is desktop
function isDesktop() {
    return window.innerWidth > 768;
}

// Format time in HH:MM:SS or MM:SS format
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        // Format: H:MM:SS for videos longer than 1 hour
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        // Format: MM:SS for videos shorter than 1 hour
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Show quality change notification
function showQualityChangeNotification(quality) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        animation: fadeInOut 3s ease-in-out;
    `;
    const content = document.createElement('div');
    content.style.cssText = 'display: flex; align-items: center; gap: 10px;';
    content.innerHTML = `
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
        </svg>
    `;
    const label = document.createElement('span');
    label.textContent = `Quality: ${quality}`;
    content.appendChild(label);
    notification.appendChild(content);

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchEpisodeData();
});

// Cleanup HLS instance and all sessions when page unloads
window.addEventListener('beforeunload', () => {
    // Close all HLS sessions (all qualities)
    if (allHLSSessions.length > 0) {
        console.log('Page unload: Cleaning up', allHLSSessions.length, 'HLS session(s)');

        // Use sendBeacon for reliable cleanup on page unload
        allHLSSessions.forEach(sessionId => {
            const url = `/api/hls/close/${sessionId}`;
            const data = JSON.stringify({});

            // sendBeacon is more reliable than fetch for beforeunload
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, data);
            } else {
                // Fallback for older browsers
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    keepalive: true
                }).catch(console.error);
            }
        });
    }

    cleanupHLS();
});

// Also cleanup on visibility change (tab close, switch)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentHLSSession) {
        console.log('Page hidden, session will auto-cleanup after timeout');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Prevent shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    const video = document.querySelector('#videoContainer video');

    // Space = play/pause
    if (e.code === 'Space') {
        e.preventDefault();
        if (video) {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
    }

    // Desktop: Arrow keys for skip 10 seconds (if enabled in settings)
    // Mobile: Arrow keys for previous/next episode
    if (isDesktop()) {


        // Desktop: Shift + Arrow for previous/next episode
        if (e.shiftKey && e.code === 'ArrowLeft' && episodeData?.navigation.prev_episode) {
            e.preventDefault();
            window.location.href = convertToPlayerUrl(episodeData.navigation.prev_episode);
        }

        if (e.shiftKey && e.code === 'ArrowRight' && episodeData?.navigation.next_episode) {
            e.preventDefault();
            window.location.href = convertToPlayerUrl(episodeData.navigation.next_episode);
        }
    } else {
        // Mobile: Arrow keys for episode navigation (original behavior)
        if (e.code === 'ArrowLeft' && episodeData?.navigation.prev_episode) {
            window.location.href = convertToPlayerUrl(episodeData.navigation.prev_episode);
        }

        if (e.code === 'ArrowRight' && episodeData?.navigation.next_episode) {
            window.location.href = convertToPlayerUrl(episodeData.navigation.next_episode);
        }
    }



    // K = play/pause (YouTube style)
    if (e.code === 'KeyK' && video) {
        e.preventDefault();
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }
});

// Main server selector handler
const mainServerSelect = document.getElementById('mainServerSelect');
if (mainServerSelect) {
    mainServerSelect.addEventListener('change', (e) => {
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
