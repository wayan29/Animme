const API_BASE = '/api/v10/vidku'
let episodeData = null
let hlsInstance = null
let dashInstance = null
let activeServerIndex = 0
let playbackMode = 'idle'
let qualityState = {
    type: 'none',
    selected: 'auto',
    options: []
}
let controlHideTimer = null
let oplayerInstance = null

function getEpisodeSlug() {
    const urlParams = new URLSearchParams(window.location.search)
    const querySlug = urlParams.get('slug')

    if (querySlug) {
        return querySlug
    }

    const pathMatch = window.location.pathname.match(/\/v10\/episode\/([^/?#]+)/)
    return pathMatch ? decodeURIComponent(pathMatch[1]) : ''
}

document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect')
    if (serverSelect) {
        serverSelect.value = 'v10'
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value)
        })
    }

    // Set active sidebar link
    const currentPath = window.location.pathname
    document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
        const href = link.getAttribute('href')
        if (currentPath === href || (href !== '/v10/' && currentPath.startsWith(href))) {
            link.classList.add('active')
        }
    })

    const slug = getEpisodeSlug()

    if (slug) {
        loadEpisode(slug)
    } else {
        showError('errorContainer', 'Slug episode tidak ditemukan')
    }

    initMobileSearch()
    initSidebarToggle()
    initPlayerControls()
})

window.addEventListener('beforeunload', () => {
    destroyOPlayer()
    cleanupHlsInstance()
    cleanupDashInstance()
})

function destroyOPlayer() {
    if (oplayerInstance && typeof oplayerInstance.destroy === 'function') {
        oplayerInstance.destroy()
    }
    oplayerInstance = null
}

function changeServer(server) {
    const slug = getEpisodeSlug()

    const TARGET_PATHS = {
        v1: `/v1/player.html?slug=${slug}`,
        v2: `/v2/player.html?slug=${slug}`,
        v3: `/v3/episode.html?slug=${slug}`,
        v4: `/v4/episode.html?slug=${slug}`,
        v5: `/v5/episode.html?slug=${slug}`,
        v6: `/v6/episode.html?slug=${slug}`,
        v7: `/v7/episode.html?slug=${slug}`,
        v8: `/v8/episode.html?slug=${slug}`,
        v9: `/v9/episode.html?slug=${slug}`,
        v10: `/v10/episode.html?slug=${slug}`
    }

    window.location.href = TARGET_PATHS[server] || `/v1/player.html?slug=${slug}`
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        return await response.json()
    } catch (error) {
        console.error('Error fetching data:', error)
        return null
    }
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}


function isAbyssPlayerUrl(url = '') {
    try {
        const parsed = new URL(url, window.location.origin)
        return /(^|\.)abyssplayer\.com$/i.test(parsed.hostname)
    } catch (error) {
        return /abyssplayer\.com/i.test(String(url))
    }
}

function renderExternalOnlyPlayer(url, reason = '') {
    const videoContainer = document.getElementById('videoContainer')
    if (!videoContainer) return

    videoContainer.innerHTML = `
        <div class="video-fallback external-only-fallback">
            <p>${escapeHtml(reason || 'Server eksternal ini menolak dimuat di iframe pada beberapa browser.')}</p>
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="download-link-chip">Buka server asli</a>
        </div>
    `
    setPlaybackMode('iframe')
    renderQualityList([], 'server', 'iframe')
    renderExternalPlayerHelp(url)
    hidePlayerLoading()
    setPlayerStatus('Server ini perlu dibuka langsung. Pilih server lain jika tersedia.', 'info')
}

function isDashStream(url = '') {
    return /\.mpd($|\?)/i.test(url)
}

function isHlsStream(url = '') {
    return /\.m3u8($|\?)/i.test(url)
}

function isDirectVideoFile(url = '') {
    return /\.(mp4|webm|ogg|mov)($|\?)/i.test(url)
}

function unwrapMediaProxyUrl(value) {
    let currentValue = String(value || '').trim()

    for (let attempt = 0; attempt < 5; attempt += 1) {
        if (!currentValue) break

        try {
            const parsed = new URL(currentValue, window.location.origin)
            if (!/\/api\/media-proxy$/i.test(parsed.pathname)) {
                break
            }

            const nestedUrl = parsed.searchParams.get('url')
            if (!nestedUrl) {
                break
            }

            currentValue = nestedUrl
        } catch (error) {
            break
        }
    }

    return currentValue
}

function getActiveDashManifestUrl() {
    const servers = getAvailableServers()
    const activeServer = servers[activeServerIndex]
    const candidateUrl = activeServer?.url || episodeData?.stream_url || ''
    return isDashStream(candidateUrl) ? candidateUrl : ''
}

function resolvePlaybackSourceUrl(url) {
    const rawUrl = unwrapMediaProxyUrl(url)
    if (!rawUrl) return ''

    const manifestUrl = getActiveDashManifestUrl()
    const manifestBaseUrl = manifestUrl ? new URL('.', manifestUrl).toString() : ''

    if (/^\/api\/media-proxy\b/i.test(rawUrl)) {
        return new URL(rawUrl, window.location.origin).toString()
    }

    if (!/^https?:\/\//i.test(rawUrl)) {
        if (manifestBaseUrl) {
            return new URL(rawUrl.replace(/^\/+/, ''), manifestBaseUrl).toString()
        }
        return rawUrl
    }

    try {
        const parsedUrl = new URL(rawUrl)
        if (parsedUrl.origin === window.location.origin && parsedUrl.pathname !== '/api/media-proxy' && manifestBaseUrl) {
            const fileName = parsedUrl.pathname.startsWith('/api/')
                ? parsedUrl.pathname.slice(5)
                : parsedUrl.pathname.split('/').pop()
            return new URL(fileName, manifestBaseUrl).toString()
        }

        return parsedUrl.toString()
    } catch (error) {
        return rawUrl
    }
}

function toMediaProxyUrl(url, referer = 'https://vidku.me/') {
    const resolvedUrl = resolvePlaybackSourceUrl(url)
    if (!resolvedUrl) return ''

    try {
        const currentUrl = new URL(resolvedUrl, window.location.origin)
        if (currentUrl.origin === window.location.origin && currentUrl.pathname === '/api/media-proxy') {
            return currentUrl.toString()
        }
    } catch (error) {
        return resolvedUrl
    }

    return `/api/media-proxy?url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent(referer)}`
}

function setPlayerStatus(message, variant = 'info') {
    const statusEl = document.getElementById('playerStatus')
    if (!statusEl) return

    statusEl.textContent = message
    statusEl.className = `player-status ${variant}`
}

function setPlaybackMode(mode) {
    playbackMode = mode
    updatePlayerControlState()
    updateCustomPlayerUi()
}

function showPlayerLoading(message = 'Memuat video...') {
    const loadingPlayer = document.getElementById('loadingPlayer')
    if (!loadingPlayer) return

    loadingPlayer.style.display = 'block'
    loadingPlayer.textContent = message
}

function hidePlayerLoading() {
    const loadingPlayer = document.getElementById('loadingPlayer')
    if (!loadingPlayer) return
    loadingPlayer.style.display = 'none'
}

function formatPlaybackTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getCustomPlayerUiElement() {
    return document.getElementById('customPlayerUi')
}

function getSeekBarElement() {
    return document.getElementById('seekBar')
}

function getOverlayQualityMenuElement() {
    return document.getElementById('overlayQualityMenu')
}

function setCustomPlayerEnabled(enabled) {
    const ui = getCustomPlayerUiElement()
    if (!ui) return

    ui.classList.toggle('is-disabled', !enabled)
    if (!enabled) {
        ui.classList.add('is-hidden')
    } else {
        ui.classList.remove('is-hidden')
    }
}

function hideOverlayQualityMenu() {
    const menu = getOverlayQualityMenuElement()
    if (menu) {
        menu.classList.add('is-hidden')
    }
}

function updateCenterPlayState(video) {
    const centerBtn = document.getElementById('centerPlayBtn')
    if (!centerBtn) return

    const shouldHide = !video || (!video.paused && !video.ended)
    centerBtn.classList.toggle('is-hidden', shouldHide)
    centerBtn.textContent = video && !video.paused ? '❚❚' : '▶'
}

function updateCustomPlayerUi() {
    const video = getCurrentVideoElement()
    if (oplayerInstance) {
        setCustomPlayerEnabled(false)
        return
    }
    const canUseCustomPlayer = playbackMode !== 'iframe' && !!video
    setCustomPlayerEnabled(canUseCustomPlayer)
    hideOverlayQualityMenu()

    const titleEl = document.getElementById('overlayEpisodeTitle')
    if (titleEl) {
        titleEl.textContent = episodeData?.title || 'AnimMe V10'
    }

    const playBtn = document.getElementById('overlayPlayBtn')
    if (playBtn) {
        playBtn.textContent = video && !video.paused ? '❚❚' : '▶'
    }

    const muteBtn = document.getElementById('overlayMuteBtn')
    if (muteBtn) {
        const isMuted = !video || video.muted || video.volume === 0
        muteBtn.textContent = isMuted ? '🔇' : '🔊'
    }

    const volumeRange = document.getElementById('overlayVolumeRange')
    if (volumeRange && video) {
        volumeRange.value = String(Math.round((video.muted ? 0 : video.volume) * 100))
    }

    const timeLabel = document.getElementById('overlayTimeLabel')
    if (timeLabel) {
        const currentTime = video?.currentTime || 0
        const duration = video?.duration || 0
        timeLabel.textContent = `${formatPlaybackTime(currentTime)} / ${formatPlaybackTime(duration)}`
    }

    const seekBar = getSeekBarElement()
    if (seekBar && video) {
        const duration = video.duration || 0
        const nextValue = duration > 0 ? Math.round((video.currentTime / duration) * 1000) : 0
        if (!seekBar.matches(':active')) {
            seekBar.value = String(nextValue)
        }
    }

    const qualityBtn = document.getElementById('overlayQualityBtn')
    if (qualityBtn) {
        const selectedOption = qualityState.options.find((option) => String(option.id) === String(qualityState.selected))
        qualityBtn.textContent = selectedOption?.label || (qualityState.selected === 'auto' ? 'Auto' : 'Kualitas')
        qualityBtn.disabled = qualityState.options.length === 0
    }

    updateCenterPlayState(video)
    updatePlayerControlState()
}

function showCustomPlayerUi(persistent = false) {
    const ui = getCustomPlayerUiElement()
    if (!ui || ui.classList.contains('is-disabled')) return

    ui.classList.remove('is-hidden')

    if (controlHideTimer) {
        window.clearTimeout(controlHideTimer)
        controlHideTimer = null
    }

    const video = getCurrentVideoElement()
    if (!persistent && video && !video.paused && playbackMode !== 'iframe') {
        controlHideTimer = window.setTimeout(() => {
            ui.classList.add('is-hidden')
            hideOverlayQualityMenu()
        }, 2200)
    }
}

function toggleVideoPlayback() {
    const video = getCurrentVideoElement()
    if (!video) return

    if (video.paused || video.ended) {
        video.play().catch(() => {})
    } else {
        video.pause()
    }
}

function cleanupHlsInstance() {
    if (hlsInstance) {
        hlsInstance.destroy()
        hlsInstance = null
    }
}

function cleanupDashInstance() {
    if (dashInstance) {
        dashInstance.reset()
        dashInstance = null
    }
}

async function resetPlayer() {
    destroyOPlayer()
    cleanupHlsInstance()
    cleanupDashInstance()
    setPlaybackMode('idle')
    renderQualityList([], 'auto', 'none')
    hideOverlayQualityMenu()

    const videoContainer = document.getElementById('videoContainer')
    if (videoContainer) {
        videoContainer.innerHTML = ''
    }

    const externalHelp = document.getElementById('externalPlayerHelp')
    if (externalHelp) {
        externalHelp.style.display = 'none'
        externalHelp.innerHTML = ''
    }
}

function createVideoElement() {
    const videoContainer = document.getElementById('videoContainer')
    if (!videoContainer) return null

    videoContainer.innerHTML = ''

    if (typeof window.OPlayer === 'function' && typeof window.OUI === 'function') {
        const player = window.OPlayer.make(videoContainer, {
            source: {
                src: ''
            },
            autoplay: false,
            preload: 'metadata',
            playsinline: true
        })

        player.use([
            window.OUI({
                theme: {
                    primaryColor: '#ef4444',
                    progress: { position: 'top', mini: false },
                    controller: { setting: 'auto', display: 'always', coverButton: true, displayBehavior: 'always' }
                },
                fullscreen: true,
                autoFocus: true,
                keyboard: { focused: true },
                settings: ['loop'],
                speeds: ['2.0', '1.5', '1.25', '1.0', '0.75', '0.5']
            })
        ])

        player.create()
        oplayerInstance = player
        const oplayerVideo = videoContainer.querySelector('video')
        if (oplayerVideo) {
            oplayerVideo.id = 'videoPlayer'
            oplayerVideo.className = 'video-player'
            oplayerVideo.crossOrigin = 'anonymous'
            updatePlayerControlState()
            return oplayerVideo
        }
    }

    const video = document.createElement('video')
    video.id = 'videoPlayer'
    video.className = 'video-player'
    video.controls = false
    video.playsInline = true
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'
    videoContainer.appendChild(video)
    updatePlayerControlState()
    updateCustomPlayerUi()
    showCustomPlayerUi(true)

    return video
}

function renderIframePlayer(url) {
    const videoContainer = document.getElementById('videoContainer')
    if (!videoContainer) return

    videoContainer.innerHTML = ''

    const iframe = document.createElement('iframe')
    iframe.src = url
    iframe.allowFullscreen = true
    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute('scrolling', 'no')
    iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture; web-share'
    iframe.referrerPolicy = 'no-referrer-when-downgrade'

    videoContainer.appendChild(iframe)
    setPlaybackMode('iframe')
    renderQualityList([], 'server', 'iframe')
    renderExternalPlayerHelp(url)
    hidePlayerLoading()
    setPlayerStatus('Server eksternal siap. Jika tidak bisa play, buka server asli.', 'success')
}

function renderExternalPlayerHelp(url) {
    const helpEl = document.getElementById('externalPlayerHelp')
    if (!helpEl) return

    helpEl.style.display = 'flex'
    helpEl.innerHTML = `
        <span>Player eksternal dimuat dari mirror. Jika muncul peringatan keamanan/anti-debug, tutup DevTools dan buka server asli atau pilih mirror lain.</span>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Buka server asli</a>
    `
}

function getCurrentVideoElement() {
    return document.getElementById('videoPlayer')
}

function getVideoContainerElement() {
    return document.querySelector('.video-container')
}

function renderQualityList(options = [], selected = 'auto', type = 'none') {
    const container = document.getElementById('qualityList')
    if (!container) return

    qualityState = {
        type,
        selected,
        options
    }

    if (!options.length) {
        const fallbackLabel = type === 'iframe' ? 'Server iframe' : (type === 'file' ? 'Sumber asli' : 'Auto')
        container.innerHTML = `<span class="quality-pill muted">${escapeHtml(fallbackLabel)}</span>`
        renderOverlayQualityMenu()
        updateCustomPlayerUi()
        return
    }

    container.innerHTML = options.map((option) => `
        <button
            type="button"
            class="quality-pill ${String(option.id) === String(selected) ? 'active' : ''}"
            onclick="selectQualityOption('${escapeHtml(String(option.id))}')"
        >
            ${escapeHtml(option.label)}
        </button>
    `).join('')

    renderOverlayQualityMenu()
    updateCustomPlayerUi()
}

function renderOverlayQualityMenu() {
    const menu = getOverlayQualityMenuElement()
    if (!menu) return

    if (!qualityState.options.length) {
        menu.innerHTML = ''
        menu.classList.add('is-hidden')
        return
    }

    menu.innerHTML = qualityState.options.map((option) => `
        <button
            type="button"
            class="overlay-quality-option ${String(option.id) === String(qualityState.selected) ? 'active' : ''}"
            data-quality-id="${escapeHtml(String(option.id))}"
        >
            ${escapeHtml(option.label)}
        </button>
    `).join('')
}

function updatePlayerControlState() {
    const pipBtn = document.getElementById('pipBtn')
    const fullscreenBtn = document.getElementById('fullscreenBtn')
    const currentVideo = getCurrentVideoElement()
    const pipSupported = !!(document.pictureInPictureEnabled && currentVideo && typeof currentVideo.requestPictureInPicture === 'function' && playbackMode !== 'iframe')

    if (pipBtn) {
        pipBtn.disabled = !pipSupported
        pipBtn.textContent = document.pictureInPictureElement ? 'Keluar PiP' : 'Picture-in-Picture'
    }

    if (fullscreenBtn) {
        fullscreenBtn.disabled = !getVideoContainerElement()
        fullscreenBtn.textContent = document.fullscreenElement ? 'Keluar Fullscreen' : 'Fullscreen'
    }

    const overlayPipBtn = document.getElementById('overlayPipBtn')
    if (overlayPipBtn) {
        overlayPipBtn.disabled = !pipSupported
        overlayPipBtn.textContent = document.pictureInPictureElement ? 'Exit PiP' : 'PiP'
    }

    const overlayFullscreenBtn = document.getElementById('overlayFullscreenBtn')
    if (overlayFullscreenBtn) {
        overlayFullscreenBtn.disabled = !getVideoContainerElement()
        overlayFullscreenBtn.textContent = document.fullscreenElement ? 'Exit' : '⛶'
    }
}

function buildQualityLabelFromBitrateInfo(info, index) {
    if (info?.height) return `${info.height}p`
    if (info?.width && info?.bandwidth) return `${Math.round(info.width)}w`
    if (info?.bandwidth) return `${Math.round(info.bandwidth / 1000)} kbps`
    return `Kualitas ${index + 1}`
}

function isDashAutoQualityEnabled() {
    if (!dashInstance) return true

    if (typeof dashInstance.getAutoSwitchQualityFor === 'function') {
        return dashInstance.getAutoSwitchQualityFor('video')
    }

    return dashInstance.getSettings?.()?.streaming?.abr?.autoSwitchBitrate?.video !== false
}

function nudgeVideoPlayback() {
    const video = getCurrentVideoElement()
    if (!video || !Number.isFinite(video.currentTime)) return

    try {
        const duration = Number.isFinite(video.duration) ? video.duration : Infinity
        const targetTime = Math.min(video.currentTime + 0.01, duration)
        video.currentTime = targetTime
    } catch (error) {
        console.warn('[V10] Failed to nudge playback after quality switch:', error)
    }
}

function syncDashQualityOptions() {
    if (!dashInstance) return

    const bitrateInfos = dashInstance.getBitrateInfoListFor('video') || []
    const options = [
        { id: 'auto', label: 'Auto' },
        ...bitrateInfos
            .map((info, index) => ({
                id: String(info.qualityIndex ?? index),
                order: Number(info.height || 0),
                label: buildQualityLabelFromBitrateInfo(info, index)
            }))
            .sort((a, b) => b.order - a.order)
    ]

    const selected = isDashAutoQualityEnabled() === false
        ? String(dashInstance.getQualityFor('video'))
        : 'auto'

    renderQualityList(options, selected, 'dash')
}

function syncHlsQualityOptions() {
    if (!hlsInstance) return

    const options = [
        { id: 'auto', label: 'Auto' },
        ...hlsInstance.levels
            .map((level, index) => ({
                id: String(index),
                order: Number(level.height || 0),
                label: level.height ? `${level.height}p` : (level.name || `Level ${index + 1}`)
            }))
            .sort((a, b) => b.order - a.order)
    ]

    const selected = hlsInstance.autoLevelEnabled ? 'auto' : String(hlsInstance.currentLevel)
    renderQualityList(options, selected, 'hls')
}

function handleQualityOptionSelect(id) {
    if (qualityState.type === 'dash' && dashInstance) {
        if (id === 'auto') {
            if (typeof dashInstance.setAutoSwitchQualityFor === 'function') {
                dashInstance.setAutoSwitchQualityFor('video', true)
            } else {
                dashInstance.updateSettings({
                    streaming: {
                        abr: {
                            autoSwitchBitrate: {
                                audio: true,
                                video: true
                            }
                        }
                    }
                })
            }
            setPlayerStatus('Kualitas video diatur ke Auto', 'success')
        } else {
            const targetQualityIndex = Number(id)
            if (typeof dashInstance.setAutoSwitchQualityFor === 'function') {
                dashInstance.setAutoSwitchQualityFor('video', false)
            } else {
                dashInstance.updateSettings({
                    streaming: {
                        abr: {
                            autoSwitchBitrate: {
                                audio: true,
                                video: false
                            }
                        }
                    }
                })
            }
            if (typeof dashInstance.setRepresentationForTypeByIndex === 'function') {
                dashInstance.setRepresentationForTypeByIndex('video', targetQualityIndex, true)
            }
            dashInstance.setQualityFor('video', targetQualityIndex)
            nudgeVideoPlayback()
            const selectedOption = qualityState.options.find((option) => String(option.id) === String(id))
            setPlayerStatus(`Kualitas video dikunci ke ${selectedOption?.label || id}`, 'success')
        }

        syncDashQualityOptions()
        return
    }

    if (qualityState.type === 'hls' && hlsInstance) {
        if (id === 'auto') {
            hlsInstance.currentLevel = -1
            hlsInstance.nextLevel = -1
            hlsInstance.loadLevel = -1
            setPlayerStatus('Kualitas video diatur ke Auto', 'success')
        } else {
            const levelIndex = Number(id)
            hlsInstance.nextLevel = levelIndex
            hlsInstance.loadLevel = levelIndex
            hlsInstance.currentLevel = levelIndex
            nudgeVideoPlayback()
            const selectedOption = qualityState.options.find((option) => String(option.id) === String(id))
            setPlayerStatus(`Kualitas video dikunci ke ${selectedOption?.label || id}`, 'success')
        }
        syncHlsQualityOptions()
    }
}

function attachVideoEvents(video) {
    if (!video) return

    video.addEventListener('play', () => {
        updateCustomPlayerUi()
        showCustomPlayerUi()
    })

    video.addEventListener('pause', () => {
        updateCustomPlayerUi()
        showCustomPlayerUi(true)
    })

    video.addEventListener('loadedmetadata', () => {
        hidePlayerLoading()
        setPlayerStatus('Video siap diputar', 'success')
        updatePlayerControlState()
        updateCustomPlayerUi()
    })

    video.addEventListener('error', () => {
        hidePlayerLoading()
        setPlayerStatus('Gagal memuat video dari server ini', 'error')
        updatePlayerControlState()
        updateCustomPlayerUi()
    })

    video.addEventListener('timeupdate', updateCustomPlayerUi)
    video.addEventListener('durationchange', updateCustomPlayerUi)
    video.addEventListener('volumechange', updateCustomPlayerUi)
    video.addEventListener('waiting', () => showCustomPlayerUi(true))
    video.addEventListener('click', toggleVideoPlayback)
}

function loadHlsPlaylist(playlistUrl) {
    const video = createVideoElement()
    if (!video) return

    attachVideoEvents(video)

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        setPlaybackMode('hls')
        hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true
        })
        hlsInstance.loadSource(playlistUrl)
        hlsInstance.attachMedia(video)
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            syncHlsQualityOptions()
            video.play().catch(() => {})
        })
        hlsInstance.on(Hls.Events.LEVEL_SWITCHED, () => {
            syncHlsQualityOptions()
        })
        hlsInstance.on(Hls.Events.ERROR, (_, data) => {
            if (data?.fatal) {
                setPlayerStatus('Stream HLS gagal dimuat', 'error')
                hidePlayerLoading()
            }
        })
        return
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
        setPlaybackMode('hls')
        renderQualityList([], 'auto', 'hls-native')
        video.src = playlistUrl
        video.play().catch(() => {})
        return
    }

    setPlayerStatus('Browser tidak mendukung HLS', 'error')
    hidePlayerLoading()
}

function loadDashManifest(manifestUrl) {
    const video = createVideoElement()
    if (!video) return

    attachVideoEvents(video)

    if (typeof dashjs === 'undefined' || !dashjs.MediaPlayer) {
        throw new Error('dash.js tidak tersedia di browser')
    }

    const proxiedManifestUrl = toMediaProxyUrl(manifestUrl)
    let dashErrorTimer = null
    setPlaybackMode('dash')
    dashInstance = dashjs.MediaPlayer().create()
    dashInstance.extend('RequestModifier', () => ({
        modifyRequestURL: (url) => toMediaProxyUrl(url),
        modifyRequestHeader: (xhr) => xhr
    }), true)
    dashInstance.updateSettings({
        streaming: {
            buffer: {
                fastSwitchEnabled: true
            },
            abr: {
                autoSwitchBitrate: {
                    audio: true,
                    video: true
                }
            }
        }
    })

    dashInstance.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
        syncDashQualityOptions()
        hidePlayerLoading()
        setPlayerStatus('Stream DASH siap diputar', 'success')
        video.play().catch(() => {})
    })

    dashInstance.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
        syncDashQualityOptions()
    })

    dashInstance.on(dashjs.MediaPlayer.events.ERROR, (event) => {
        console.error('[V10] DASH error:', event)
        if (dashErrorTimer) {
            window.clearTimeout(dashErrorTimer)
        }

        dashErrorTimer = window.setTimeout(() => {
            const hasPlayableMedia = video.readyState >= 1 || (Number.isFinite(video.duration) && video.duration > 0)
            if (!hasPlayableMedia) {
                hidePlayerLoading()
                setPlayerStatus('Stream DASH gagal dimuat dari browser', 'error')
            }
        }, 1200)
    })

    dashInstance.initialize(video, proxiedManifestUrl, true)
}

function loadDirectVideo(url) {
    const video = createVideoElement()
    if (!video) return

    attachVideoEvents(video)
    setPlaybackMode('file')
    renderQualityList([], 'source', 'file')
    video.src = toMediaProxyUrl(url)
    video.load()
    video.play().catch(() => {})
}

function getAvailableServers() {
    if (!episodeData) return []

    if (Array.isArray(episodeData.stream_servers) && episodeData.stream_servers.length > 0) {
        return episodeData.stream_servers.filter((server) => server && server.url)
    }

    if (episodeData.stream_url) {
        return [{ name: 'Default', url: episodeData.stream_url }]
    }

    return []
}

function renderServerList() {
    const container = document.getElementById('serverList')
    if (!container) return

    const servers = getAvailableServers()

    if (servers.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada server streaming tersedia.</div>'
        return
    }

    container.innerHTML = servers.map((server, index) => `
        <button class="server-pill ${index === activeServerIndex ? 'active' : ''}" onclick="selectStreamingServer(${index})">
            ${escapeHtml(server.name || `Server ${index + 1}`)}
        </button>
    `).join('')
}

async function playStreamingServer(index) {
    const servers = getAvailableServers()
    const server = servers[index]

    if (!server || !server.url) {
        setPlayerStatus('URL server tidak tersedia', 'error')
        return
    }

    activeServerIndex = index
    renderServerList()
    showPlayerLoading(`Menyiapkan ${server.name || `Server ${index + 1}`}...`)
    setPlayerStatus(`Memuat ${server.name || `Server ${index + 1}`}...`, 'info')

    await resetPlayer()

    try {
        if (isDashStream(server.url)) {
            loadDashManifest(server.url)
            return
        }

        if (isHlsStream(server.url)) {
            loadHlsPlaylist(server.url)
            return
        }

        if (isDirectVideoFile(server.url)) {
            loadDirectVideo(server.url)
            return
        }

        if (isAbyssPlayerUrl(server.url)) {
            renderExternalOnlyPlayer(
                server.url,
                'AbyssPlayer sedang menolak akses iframe karena proteksi anti-debug/anti-embed. Buka server asli atau pilih mirror lain.'
            )
            return
        }

        renderIframePlayer(server.url)
    } catch (error) {
        console.error('[V10] Player load error:', error)
        hidePlayerLoading()
        setPlayerStatus('Gagal memuat server ini. Coba server lain atau gunakan link download.', 'error')
        const videoContainer = document.getElementById('videoContainer')
        if (videoContainer) {
            videoContainer.innerHTML = `
                <div class="video-fallback">
                    <p>Server tidak dapat diputar otomatis.</p>
                    <a href="${escapeHtml(server.url)}" target="_blank" rel="noopener noreferrer" class="download-link-chip">Buka server asli</a>
                </div>
            `
        }
    }
}

function renderDownloadLinks() {
    const container = document.getElementById('downloadLinks')
    if (!container) return

    const links = Array.isArray(episodeData?.download_links) ? episodeData.download_links : []

    if (links.length === 0) {
        container.innerHTML = '<div class="loading">Belum ada link download tersedia.</div>'
        return
    }

    container.innerHTML = links.map((link) => `
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="download-link-chip">
            ${escapeHtml(link.quality || 'Download')}
        </a>
    `).join('')
}

function renderEpisodeListPanel(detailData) {
    const container = document.getElementById('episodeListPanel')
    if (!container) return

    const episodeList = Array.isArray(detailData?.episode_lists)
        ? [...detailData.episode_lists].sort((a, b) => {
            const aValue = Number.parseFloat(String(a?.episode_number || '').replace(',', '.'))
            const bValue = Number.parseFloat(String(b?.episode_number || '').replace(',', '.'))
            return (Number.isFinite(bValue) ? bValue : -Infinity) - (Number.isFinite(aValue) ? aValue : -Infinity)
        })
        : []

    if (!episodeList.length) {
        container.innerHTML = '<div class="loading">Daftar episode belum tersedia.</div>'
        return
    }

    container.innerHTML = episodeList.map((episode) => `
        <a
            href="/v10/episode?slug=${encodeURIComponent(episode.slug || '')}"
            class="player-episode-link ${episode.slug === episodeData?.slug ? 'active' : ''}"
        >
            ${escapeHtml(episode.title || `Episode ${episode.episode_number || '?'}`)}
        </a>
    `).join('')
}

async function loadEpisodeListPanel() {
    const container = document.getElementById('episodeListPanel')
    if (!container) return

    if (!episodeData?.anime_slug) {
        container.innerHTML = '<div class="loading">Daftar episode tidak tersedia.</div>'
        return
    }

    container.innerHTML = '<div class="loading">Memuat daftar episode...</div>'
    const detailResponse = await fetchAPI(`/anime/${episodeData.anime_slug}`)

    if (!detailResponse?.data) {
        container.innerHTML = '<div class="error">Gagal memuat daftar episode.</div>'
        return
    }

    renderEpisodeListPanel(detailResponse.data)
}

function renderEpisodeInfo() {
    const episodeInfo = document.getElementById('episodeInfo')
    const playerHeading = document.querySelector('.player-heading')
    
    if (playerHeading && episodeData) {
        playerHeading.textContent = episodeData.title || 'Streaming Episode'
    }

    if (!episodeInfo || !episodeData) return

    episodeInfo.innerHTML = `
        <div class="episode-info-header">
            <div>
                <p class="episode-kicker">${escapeHtml(episodeData.anime_title || 'Vidku')}</p>
                <h2 class="episode-title">${escapeHtml(episodeData.title || '')}</h2>
            </div>
            ${episodeData.anime_slug ? `
                <a href="/v10/detail?slug=${encodeURIComponent(episodeData.anime_slug)}" class="episode-back-link">
                    Buka halaman anime
                </a>
            ` : ''}
        </div>
        ${episodeData.description ? `<p class="episode-description">${escapeHtml(episodeData.description)}</p>` : ''}
    `

    updateQuickMeta()
}

function updateQuickMeta() {
    const animeChip = document.getElementById('animeChip')
    const episodeChip = document.getElementById('episodeChip')
    const serverCountChip = document.getElementById('serverCountChip')

    if (animeChip) {
        animeChip.textContent = episodeData?.anime_title || 'Vidku'
    }

    if (episodeChip) {
        episodeChip.textContent = episodeData?.episode_number
            ? `Episode ${episodeData.episode_number}`
            : (episodeData?.title || 'Episode')
    }

    if (serverCountChip) {
        serverCountChip.textContent = `${getAvailableServers().length} mirror`
    }
}

async function loadEpisode(slug) {
    setPlayerStatus('Memuat data episode...', 'info')
    showPlayerLoading('Memuat data episode...')

    const data = await fetchAPI(`/episode/${slug}`)

    if (!data || !data.data) {
        showError('errorContainer', 'Gagal memuat episode')
        hidePlayerLoading()
        setPlayerStatus('Gagal memuat data episode', 'error')
        return
    }

    episodeData = data.data
    renderEpisodeInfo()
    renderDownloadLinks()
    renderServerList()
    updateQuickMeta()
    updateEpisodeNavigation()
    await loadEpisodeListPanel()

    const servers = getAvailableServers()
    if (servers.length > 0) {
        playStreamingServer(0)
    } else {
        hidePlayerLoading()
        setPlayerStatus('Tidak ada server streaming tersedia', 'error')
    }
}

function updateEpisodeNavigation() {
    const prevBtn = document.getElementById('prevEpisodeBtn')
    const nextBtn = document.getElementById('nextEpisodeBtn')

    if (prevBtn) {
        if (episodeData && episodeData.prev_episode) {
            prevBtn.disabled = false
            prevBtn.onclick = () => {
                window.location.href = `/v10/episode?slug=${episodeData.prev_episode}`
            }
        } else {
            prevBtn.disabled = true
            prevBtn.onclick = null
        }
    }

    if (nextBtn) {
        if (episodeData && episodeData.next_episode) {
            nextBtn.disabled = false
            nextBtn.onclick = () => {
                window.location.href = `/v10/episode?slug=${episodeData.next_episode}`
            }
        } else {
            nextBtn.disabled = true
            nextBtn.onclick = null
        }
    }
}

function showError(containerId, message) {
    const container = document.getElementById(containerId)
    if (container) {
        container.style.display = 'block'
        container.innerHTML = `<div class="error">${escapeHtml(message)}</div>`
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput')
    const keyword = searchInput ? searchInput.value.trim() : ''

    if (keyword) {
        window.location.href = `/v10/search?q=${encodeURIComponent(keyword)}`
    }
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn')
    const searchCloseBtn = document.getElementById('searchCloseBtn')
    const searchContainer = document.querySelector('.search-container')

    if (searchIconBtn && searchContainer) {
        searchIconBtn.addEventListener('click', () => {
            searchContainer.classList.add('active')
        })
    }

    if (searchCloseBtn && searchContainer) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer.classList.remove('active')
        })
    }

    const searchInput = document.getElementById('searchInput')
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAnime()
            }
        })
    }
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle')
    const menuCloseBtn = document.getElementById('menuCloseBtn')
    const sidebar = document.getElementById('sidebar')
    const backdrop = document.getElementById('sidebarBackdrop')

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active')
            if (backdrop) backdrop.classList.add('active')
        })
    }

    if (menuCloseBtn && sidebar) {
        menuCloseBtn.addEventListener('click', () => {
            sidebar.classList.remove('active')
            if (backdrop) backdrop.classList.remove('active')
        })
    }

    if (backdrop && sidebar) {
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('active')
            backdrop.classList.remove('active')
        })
    }
}

function initPlayerControls() {
    const pipBtn = document.getElementById('pipBtn')
    const fullscreenBtn = document.getElementById('fullscreenBtn')
    const overlayPipBtn = document.getElementById('overlayPipBtn')
    const overlayFullscreenBtn = document.getElementById('overlayFullscreenBtn')
    const overlayPlayBtn = document.getElementById('overlayPlayBtn')
    const centerPlayBtn = document.getElementById('centerPlayBtn')
    const overlayMuteBtn = document.getElementById('overlayMuteBtn')
    const overlayVolumeRange = document.getElementById('overlayVolumeRange')
    const seekBar = getSeekBarElement()
    const overlayQualityBtn = document.getElementById('overlayQualityBtn')
    const overlayQualityMenu = getOverlayQualityMenuElement()
    const videoFrame = document.getElementById('videoFrame')

    const handlePipToggle = async () => {
        const video = getCurrentVideoElement()
        if (!video || !document.pictureInPictureEnabled || typeof video.requestPictureInPicture !== 'function') {
            return
        }

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture()
            } else {
                await video.requestPictureInPicture()
            }
        } catch (error) {
            console.warn('[V10] PiP failed:', error)
        } finally {
            updatePlayerControlState()
            showCustomPlayerUi(true)
        }
    }

    const handleFullscreenToggle = async () => {
        const container = getVideoContainerElement()
        if (!container) return

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen()
            } else if (container.requestFullscreen) {
                await container.requestFullscreen()
            }
        } catch (error) {
            console.warn('[V10] Fullscreen failed:', error)
        } finally {
            updatePlayerControlState()
            showCustomPlayerUi(true)
        }
    }

    if (pipBtn) {
        pipBtn.addEventListener('click', handlePipToggle)
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', handleFullscreenToggle)
    }

    if (overlayPipBtn) {
        overlayPipBtn.addEventListener('click', handlePipToggle)
    }

    if (overlayFullscreenBtn) {
        overlayFullscreenBtn.addEventListener('click', handleFullscreenToggle)
    }

    if (overlayPlayBtn) {
        overlayPlayBtn.addEventListener('click', () => {
            toggleVideoPlayback()
            showCustomPlayerUi(true)
        })
    }

    if (centerPlayBtn) {
        centerPlayBtn.addEventListener('click', () => {
            toggleVideoPlayback()
            showCustomPlayerUi(true)
        })
    }

    if (overlayMuteBtn) {
        overlayMuteBtn.addEventListener('click', () => {
            const video = getCurrentVideoElement()
            if (!video) return

            video.muted = !video.muted
            if (!video.muted && video.volume === 0) {
                video.volume = 1
            }
            updateCustomPlayerUi()
            showCustomPlayerUi(true)
        })
    }

    if (overlayVolumeRange) {
        overlayVolumeRange.addEventListener('input', (event) => {
            const video = getCurrentVideoElement()
            if (!video) return

            const nextVolume = Number(event.target.value) / 100
            video.volume = nextVolume
            video.muted = nextVolume === 0
            updateCustomPlayerUi()
            showCustomPlayerUi(true)
        })
    }

    if (seekBar) {
        seekBar.addEventListener('input', (event) => {
            const video = getCurrentVideoElement()
            if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return

            const ratio = Number(event.target.value) / 1000
            video.currentTime = ratio * video.duration
            updateCustomPlayerUi()
            showCustomPlayerUi(true)
        })
    }

    if (overlayQualityBtn) {
        overlayQualityBtn.addEventListener('click', () => {
            if (!qualityState.options.length) return
            overlayQualityMenu?.classList.toggle('is-hidden')
            showCustomPlayerUi(true)
        })
    }

    if (overlayQualityMenu) {
        overlayQualityMenu.addEventListener('click', (event) => {
            const button = event.target.closest('[data-quality-id]')
            if (!button) return
            handleQualityOptionSelect(button.getAttribute('data-quality-id') || 'auto')
            hideOverlayQualityMenu()
            showCustomPlayerUi(true)
        })
    }

    if (videoFrame) {
        videoFrame.addEventListener('mousemove', () => showCustomPlayerUi())
        videoFrame.addEventListener('mouseenter', () => showCustomPlayerUi(true))
        videoFrame.addEventListener('mouseleave', () => showCustomPlayerUi())
    }

    document.addEventListener('click', (event) => {
        if (overlayQualityMenu && overlayQualityBtn && !overlayQualityMenu.contains(event.target) && event.target !== overlayQualityBtn) {
            hideOverlayQualityMenu()
        }
    })

    document.addEventListener('fullscreenchange', updatePlayerControlState)
    document.addEventListener('enterpictureinpicture', updatePlayerControlState)
    document.addEventListener('leavepictureinpicture', updatePlayerControlState)
    updatePlayerControlState()
    updateCustomPlayerUi()
}

window.selectStreamingServer = (index) => {
    playStreamingServer(index)
}

window.selectQualityOption = (id) => {
    handleQualityOptionSelect(id)
}
