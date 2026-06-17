// YouTube-Style Video Player Controller
// Full-featured custom video player with YouTube-like functionality

class YouTubePlayer {
    constructor(container, videoElement) {
        this.container = container;
        this.video = videoElement;
        this.isPlaying = false;
        this.isDragging = false;
        this.currentQuality = 'auto';
        this.currentSpeed = 1;
        this.volume = 1;
        this.isMuted = false;
        this.isTheaterMode = false;
        this.controlsTimeout = null;
        this.lastMouseMove = Date.now();

        // Double tap tracking
        this.lastTapLeft = 0;
        this.lastTapRight = 0;
        this.tapTimeout = null;

        this.init();
    }

    init() {
        this.buildControls();
        this.attachEventListeners();
        this.setupKeyboardShortcuts();
        // Show controls initially
        this.showControls();
        // Enable auto-hide timer for better UX
        this.startControlsTimer();
        console.log('YouTube Player initialized');
    }

    buildControls() {
        // Remove native controls
        this.video.controls = false;

        // Add YouTube-style player class
        this.container.classList.add('youtube-player');

        // Build control elements
        const controlsHTML = `
            <!-- Big Play Button -->
            <div class="youtube-play-button" data-player-play-btn>
                <svg viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>

            <!-- Buffer Spinner -->
            <div class="youtube-buffer-spinner" data-player-spinner></div>

            <!-- Click Overlay -->
            <div class="youtube-player-overlay" data-player-overlay></div>

            <!-- Double Tap Zones (Mobile) -->
            <div class="youtube-tap-zone youtube-tap-zone-left" data-tap-zone-left></div>
            <div class="youtube-tap-zone youtube-tap-zone-right" data-tap-zone-right></div>

            <!-- Tap Feedback (Mobile) -->
            <div class="youtube-tap-feedback left" data-tap-feedback-left></div>
            <div class="youtube-tap-feedback right" data-tap-feedback-right></div>

            <!-- Tap Indicators (Mobile) -->
            <div class="youtube-tap-indicator left" data-tap-indicator-left>
                <div class="youtube-tap-indicator-icon">
                    <svg viewBox="0 0 24 24"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                    <svg viewBox="0 0 24 24"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                    <svg viewBox="0 0 24 24"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                </div>
                <div class="youtube-tap-indicator-text">10 seconds</div>
            </div>
            <div class="youtube-tap-indicator right" data-tap-indicator-right>
                <div class="youtube-tap-indicator-icon">
                    <svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
                    <svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
                    <svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>
                </div>
                <div class="youtube-tap-indicator-text">10 seconds</div>
            </div>

            <!-- Skip Buttons -->
            <div class="youtube-skip-buttons" data-player-skip-buttons style="display: none;">
                <button class="youtube-skip-btn" data-skip-backward>
                    <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
                    10s
                </button>
                <button class="youtube-skip-btn" data-skip-forward>
                    10s
                    <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
                </button>
            </div>

            <!-- Notification -->
            <div class="youtube-notification" data-player-notification></div>

            <!-- Close Button (Mobile) - Outside controls so always visible -->
            <button class="youtube-close-controls" data-close-controls title="Hide controls">
                <svg viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>

            <!-- Controls -->
            <div class="youtube-controls" data-player-controls>
                <!-- Progress Bar -->
                <div class="youtube-progress-container" data-progress-container>
                    <div class="youtube-progress-bar">
                        <div class="youtube-progress-buffered" data-progress-buffered></div>
                        <div class="youtube-progress-played" data-progress-played>
                            <div class="youtube-progress-handle"></div>
                        </div>
                    </div>
                    <div class="youtube-time-tooltip" data-time-tooltip>0:00</div>
                </div>

                <!-- Bottom Controls -->
                <div class="youtube-bottom-controls">
                    <!-- Play/Pause -->
                    <button class="youtube-control-btn" data-play-pause title="Play (k)">
                        <svg data-play-icon viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <svg data-pause-icon viewBox="0 0 24 24" style="display: none;">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                    </button>

                    <!-- Volume -->
                    <div class="youtube-volume-container">
                        <button class="youtube-control-btn small" data-volume-btn title="Mute (m)">
                            <svg data-volume-high viewBox="0 0 24 24">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                            </svg>
                            <svg data-volume-muted viewBox="0 0 24 24" style="display: none;">
                                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                            </svg>
                        </button>
                        <div class="youtube-volume-slider" data-volume-slider>
                            <div class="youtube-volume-level" data-volume-level style="width: 100%;"></div>
                        </div>
                    </div>

                    <!-- Time -->
                    <div class="youtube-time-display">
                        <span data-current-time>0:00</span>
                        <span class="youtube-time-separator">/</span>
                        <span data-duration>0:00</span>
                    </div>

                    <!-- Spacer -->
                    <div class="youtube-spacer"></div>

                    <!-- Quality Badge -->
                    <div class="youtube-quality-badge" data-quality-badge style="display: none;">HD</div>

                    <!-- Settings -->
                    <button class="youtube-control-btn" data-settings-btn title="Settings">
                        <svg viewBox="0 0 24 24">
                            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                        </svg>
                    </button>

                    <!-- Theater Mode -->
                    <button class="youtube-control-btn" data-theater-btn title="Theater mode (t)">
                        <svg data-theater-off viewBox="0 0 24 24">
                            <path d="M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z"/>
                        </svg>
                        <svg data-theater-on viewBox="0 0 24 24" style="display: none;">
                            <path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z"/>
                        </svg>
                    </button>

                    <!-- PiP -->
                    <button class="youtube-control-btn" data-pip-btn title="Picture-in-picture (i)" style="display: none;">
                        <svg viewBox="0 0 24 24">
                            <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/>
                        </svg>
                    </button>

                    <!-- Fullscreen -->
                    <button class="youtube-control-btn" data-fullscreen-btn title="Fullscreen (f)">
                        <svg data-fullscreen-enter viewBox="0 0 24 24">
                            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                        </svg>
                        <svg data-fullscreen-exit viewBox="0 0 24 24" style="display: none;">
                            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Settings Menu -->
            <div class="youtube-settings-menu" data-settings-menu>
                <div class="youtube-settings-item" data-quality-setting>
                    <span class="youtube-settings-label">Quality</span>
                    <span class="youtube-settings-value" data-quality-value>Auto</span>
                </div>
                <div class="youtube-settings-item" data-speed-setting>
                    <span class="youtube-settings-label">Speed</span>
                    <span class="youtube-settings-value" data-speed-value>Normal</span>
                </div>
            </div>
        `;

        this.container.insertAdjacentHTML('beforeend', controlsHTML);

        // Get element references
        this.elements = {
            playBtn: this.container.querySelector('[data-player-play-btn]'),
            overlay: this.container.querySelector('[data-player-overlay]'),
            tapZoneLeft: this.container.querySelector('[data-tap-zone-left]'),
            tapZoneRight: this.container.querySelector('[data-tap-zone-right]'),
            tapFeedbackLeft: this.container.querySelector('[data-tap-feedback-left]'),
            tapFeedbackRight: this.container.querySelector('[data-tap-feedback-right]'),
            tapIndicatorLeft: this.container.querySelector('[data-tap-indicator-left]'),
            tapIndicatorRight: this.container.querySelector('[data-tap-indicator-right]'),
            spinner: this.container.querySelector('[data-player-spinner]'),
            controls: this.container.querySelector('[data-player-controls]'),
            closeControlsBtn: this.container.querySelector('[data-close-controls]'),
            playPauseBtn: this.container.querySelector('[data-play-pause]'),
            playIcon: this.container.querySelector('[data-play-icon]'),
            pauseIcon: this.container.querySelector('[data-pause-icon]'),
            progressContainer: this.container.querySelector('[data-progress-container]'),
            progressPlayed: this.container.querySelector('[data-progress-played]'),
            progressBuffered: this.container.querySelector('[data-progress-buffered]'),
            timeTooltip: this.container.querySelector('[data-time-tooltip]'),
            currentTime: this.container.querySelector('[data-current-time]'),
            duration: this.container.querySelector('[data-duration]'),
            volumeBtn: this.container.querySelector('[data-volume-btn]'),
            volumeHigh: this.container.querySelector('[data-volume-high]'),
            volumeMuted: this.container.querySelector('[data-volume-muted]'),
            volumeSlider: this.container.querySelector('[data-volume-slider]'),
            volumeLevel: this.container.querySelector('[data-volume-level]'),
            settingsBtn: this.container.querySelector('[data-settings-btn]'),
            settingsMenu: this.container.querySelector('[data-settings-menu]'),
            qualitySetting: this.container.querySelector('[data-quality-setting]'),
            qualityValue: this.container.querySelector('[data-quality-value]'),
            speedSetting: this.container.querySelector('[data-speed-setting]'),
            speedValue: this.container.querySelector('[data-speed-value]'),
            qualityBadge: this.container.querySelector('[data-quality-badge]'),
            theaterBtn: this.container.querySelector('[data-theater-btn]'),
            theaterOn: this.container.querySelector('[data-theater-on]'),
            theaterOff: this.container.querySelector('[data-theater-off]'),
            pipBtn: this.container.querySelector('[data-pip-btn]'),
            fullscreenBtn: this.container.querySelector('[data-fullscreen-btn]'),
            fullscreenEnter: this.container.querySelector('[data-fullscreen-enter]'),
            fullscreenExit: this.container.querySelector('[data-fullscreen-exit]'),
            notification: this.container.querySelector('[data-player-notification]'),
            skipButtons: this.container.querySelector('[data-player-skip-buttons]'),
            skipBackward: this.container.querySelector('[data-skip-backward]'),
            skipForward: this.container.querySelector('[data-skip-forward]')
        };

        // Show PiP button if supported
        if (document.pictureInPictureEnabled) {
            this.elements.pipBtn.style.display = '';
        }
    }

    attachEventListeners() {
        // Video events
        this.video.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
        this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.video.addEventListener('progress', () => this.onProgress());
        this.video.addEventListener('waiting', () => this.showSpinner());
        this.video.addEventListener('canplay', () => this.hideSpinner());
        this.video.addEventListener('play', () => this.onPlay());
        this.video.addEventListener('pause', () => this.onPause());
        this.video.addEventListener('ended', () => this.onEnded());
        this.video.addEventListener('volumechange', () => this.onVolumeChange());

        // Play button - use touchend to avoid conflicts on mobile
        this.elements.playBtn.addEventListener('click', (e) => {
            if (!this.isTouchDevice()) {
                this.togglePlay();
            }
        });
        this.elements.playBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.togglePlay();
        });

        this.elements.playPauseBtn.addEventListener('click', () => this.togglePlay());

        // Overlay click - only on desktop, mobile uses tap zones
        this.elements.overlay.addEventListener('click', (e) => {
            if (!this.isTouchDevice()) {
                this.togglePlay();
            }
        });

        // Close controls button
        this.elements.closeControlsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideControls();
        });
        // Touch event for close button (mobile) - prevent conflicts
        this.elements.closeControlsBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        });
        this.elements.closeControlsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideControls();
        });

        // Double click for fullscreen
        this.elements.overlay.addEventListener('dblclick', () => this.toggleFullscreen());

        // Progress bar
        this.elements.progressContainer.addEventListener('mousedown', (e) => this.onProgressMouseDown(e));
        this.elements.progressContainer.addEventListener('mousemove', (e) => this.onProgressMouseMove(e));
        this.elements.progressContainer.addEventListener('mouseleave', () => this.hideTimeTooltip());

        // Volume
        this.elements.volumeBtn.addEventListener('click', () => this.toggleMute());
        this.elements.volumeSlider.addEventListener('click', (e) => this.setVolume(e));

        // Settings
        this.elements.settingsBtn.addEventListener('click', () => this.toggleSettings());
        this.elements.qualitySetting.addEventListener('click', () => this.showQualityMenu());
        this.elements.speedSetting.addEventListener('click', () => this.showSpeedMenu());

        // Theater mode
        this.elements.theaterBtn.addEventListener('click', () => this.toggleTheaterMode());

        // PiP
        if (this.elements.pipBtn) {
            this.elements.pipBtn.addEventListener('click', () => this.togglePiP());
        }

        // Fullscreen
        this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Skip buttons
        if (this.elements.skipBackward) {
            this.elements.skipBackward.addEventListener('click', () => this.skip(-10));
        }
        if (this.elements.skipForward) {
            this.elements.skipForward.addEventListener('click', () => this.skip(10));
        }

        // Mouse move to show controls
        this.container.addEventListener('mousemove', () => this.onMouseMove());

        // Touch events for mobile to show controls
        this.container.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.container.addEventListener('touchmove', (e) => this.onTouchMove(e));

        // Single tap overlay to toggle controls
        this.elements.overlay.addEventListener('touchend', (e) => this.onOverlayTap(e));

        // Mobile double tap zones
        if (this.elements.tapZoneLeft) {
            this.elements.tapZoneLeft.addEventListener('click', (e) => this.handleDoubleTapLeft(e));
        }
        if (this.elements.tapZoneRight) {
            this.elements.tapZoneRight.addEventListener('click', (e) => this.handleDoubleTapRight(e));
        }

        // Fullscreen change
        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('msfullscreenchange', () => this.onFullscreenChange());
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Skip if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch(e.code) {
                case 'Space':
                case 'KeyK':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowLeft':
                case 'KeyJ':
                    e.preventDefault();
                    this.skip(-10);
                    break;
                case 'ArrowRight':
                case 'KeyL':
                    e.preventDefault();
                    this.skip(10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.changeVolume(0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.changeVolume(-0.1);
                    break;
                case 'KeyM':
                    e.preventDefault();
                    this.toggleMute();
                    break;
                case 'KeyF':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
                case 'KeyT':
                    e.preventDefault();
                    this.toggleTheaterMode();
                    break;
                case 'KeyI':
                    e.preventDefault();
                    if (document.pictureInPictureEnabled) this.togglePiP();
                    break;
                case 'Digit0':
                case 'Digit1':
                case 'Digit2':
                case 'Digit3':
                case 'Digit4':
                case 'Digit5':
                case 'Digit6':
                case 'Digit7':
                case 'Digit8':
                case 'Digit9':
                    e.preventDefault();
                    const num = parseInt(e.code.replace('Digit', ''));
                    this.seekToPercentage(num * 10);
                    break;
            }
        });
    }

    // Video Control Methods
    togglePlay() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    onPlay() {
        this.isPlaying = true;

        // Hide big play button properly
        this.elements.playBtn.classList.add('hidden');
        this.elements.playBtn.style.display = 'none';

        // Update control bar icons
        this.elements.playIcon.style.display = 'none';
        this.elements.pauseIcon.style.display = '';

        // Show controls when play starts, then start auto-hide timer
        this.showControls();
        this.resetControlsTimer();
    }

    onPause() {
        this.isPlaying = false;

        // Show big play button properly
        this.elements.playBtn.classList.remove('hidden');
        this.elements.playBtn.style.display = 'flex';

        // Update control bar icons
        this.elements.playIcon.style.display = '';
        this.elements.pauseIcon.style.display = 'none';

        // Show controls when paused and keep them visible
        this.showControls();
        this.clearControlsTimer();
    }

    onEnded() {
        this.isPlaying = false;

        // Show big play button when video ends
        this.elements.playBtn.classList.remove('hidden');
        this.elements.playBtn.style.display = 'flex';

        // Update control bar icons
        this.elements.playIcon.style.display = '';
        this.elements.pauseIcon.style.display = 'none';

        // Show controls and keep visible
        this.showControls();
        this.clearControlsTimer();

        this.showNotification('Video ended');
    }

    skip(seconds) {
        this.video.currentTime += seconds;
        this.showNotification(`${seconds > 0 ? '+' : ''}${seconds}s`);
    }

    seekToPercentage(percent) {
        this.video.currentTime = (this.video.duration / 100) * percent;
    }

    // Mobile Double Tap Handlers
    handleDoubleTapLeft(e) {
        e.preventDefault();
        e.stopPropagation();

        const now = Date.now();
        const timeSinceLastTap = now - this.lastTapLeft;

        if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
            // Double tap detected
            this.skip(-10);
            this.showTapFeedback('left');
            this.lastTapLeft = 0; // Reset to prevent triple tap
        } else {
            // First tap
            this.lastTapLeft = now;

            // Reset after 300ms if no second tap
            clearTimeout(this.tapTimeout);
            this.tapTimeout = setTimeout(() => {
                this.lastTapLeft = 0;
            }, 300);
        }
    }

    handleDoubleTapRight(e) {
        e.preventDefault();
        e.stopPropagation();

        const now = Date.now();
        const timeSinceLastTap = now - this.lastTapRight;

        if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
            // Double tap detected
            this.skip(10);
            this.showTapFeedback('right');
            this.lastTapRight = 0; // Reset to prevent triple tap
        } else {
            // First tap
            this.lastTapRight = now;

            // Reset after 300ms if no second tap
            clearTimeout(this.tapTimeout);
            this.tapTimeout = setTimeout(() => {
                this.lastTapRight = 0;
            }, 300);
        }
    }

    showTapFeedback(side) {
        const feedback = side === 'left' ? this.elements.tapFeedbackLeft : this.elements.tapFeedbackRight;
        const indicator = side === 'left' ? this.elements.tapIndicatorLeft : this.elements.tapIndicatorRight;

        // Show ripple effect
        feedback.classList.remove('show');
        void feedback.offsetWidth; // Force reflow
        feedback.classList.add('show');

        // Show indicator
        indicator.classList.add('show');

        // Hide after animation
        setTimeout(() => {
            feedback.classList.remove('show');
            indicator.classList.remove('show');
        }, 600);
    }

    // Progress Bar
    onLoadedMetadata() {
        this.elements.duration.textContent = this.formatTime(this.video.duration);
    }

    onTimeUpdate() {
        const percent = (this.video.currentTime / this.video.duration) * 100;
        this.elements.progressPlayed.style.width = percent + '%';
        this.elements.currentTime.textContent = this.formatTime(this.video.currentTime);
    }

    onProgress() {
        if (this.video.buffered.length > 0) {
            const buffered = (this.video.buffered.end(this.video.buffered.length - 1) / this.video.duration) * 100;
            this.elements.progressBuffered.style.width = buffered + '%';
        }
    }

    onProgressMouseDown(e) {
        this.isDragging = true;
        this.setProgress(e);
        document.addEventListener('mousemove', this.onDocumentMouseMove);
        document.addEventListener('mouseup', this.onDocumentMouseUp);
    }

    onDocumentMouseMove = (e) => {
        if (this.isDragging) {
            this.setProgress(e);
        }
    }

    onDocumentMouseUp = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.onDocumentMouseMove);
        document.removeEventListener('mouseup', this.onDocumentMouseUp);
    }

    setProgress(e) {
        const rect = this.elements.progressContainer.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        this.video.currentTime = (this.video.duration / 100) * percent;
    }

    onProgressMouseMove(e) {
        const rect = this.elements.progressContainer.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        const time = (this.video.duration / 100) * percent;

        this.elements.timeTooltip.textContent = this.formatTime(time);
        this.elements.timeTooltip.style.left = percent + '%';
        this.elements.timeTooltip.classList.add('show');
    }

    hideTimeTooltip() {
        if (!this.isDragging) {
            this.elements.timeTooltip.classList.remove('show');
        }
    }

    // Volume
    toggleMute() {
        if (this.video.muted) {
            this.video.muted = false;
            this.video.volume = this.volume;
        } else {
            this.video.muted = true;
        }
    }

    onVolumeChange() {
        this.isMuted = this.video.muted;
        this.volume = this.video.volume;

        if (this.isMuted || this.volume === 0) {
            this.elements.volumeHigh.style.display = 'none';
            this.elements.volumeMuted.style.display = '';
        } else {
            this.elements.volumeHigh.style.display = '';
            this.elements.volumeMuted.style.display = 'none';
        }

        this.elements.volumeLevel.style.width = (this.volume * 100) + '%';
    }

    setVolume(e) {
        const rect = this.elements.volumeSlider.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.video.volume = Math.max(0, Math.min(1, percent));
        this.video.muted = false;
    }

    changeVolume(delta) {
        this.video.volume = Math.max(0, Math.min(1, this.video.volume + delta));
        this.video.muted = false;
        this.showNotification(`Volume: ${Math.round(this.video.volume * 100)}%`);
    }

    // Settings
    toggleSettings() {
        this.elements.settingsMenu.classList.toggle('show');
    }

    showQualityMenu() {
        // If custom quality callback is set, use it
        if (this.onQualityMenuClick) {
            this.onQualityMenuClick();
            return;
        }

        // Otherwise show default quality options
        const qualities = ['Auto', '360p', '480p', '720p', '1080p'];
        this.showOptionsMenu('Quality', qualities, (quality) => {
            this.setQuality(quality);
            this.elements.qualityValue.textContent = quality;
        });
    }

    showSpeedMenu() {
        // If custom speed callback is set, use it
        if (this.onSpeedMenuClick) {
            this.onSpeedMenuClick();
            return;
        }

        // Otherwise show default speed options
        const speeds = [
            { label: '0.25x', value: 0.25 },
            { label: '0.5x', value: 0.5 },
            { label: '0.75x', value: 0.75 },
            { label: 'Normal', value: 1 },
            { label: '1.25x', value: 1.25 },
            { label: '1.5x', value: 1.5 },
            { label: '1.75x', value: 1.75 },
            { label: '2x', value: 2 }
        ];

        this.showOptionsMenu('Speed', speeds.map(s => s.label), (label, index) => {
            const speed = speeds[index].value;
            this.setSpeed(speed);
            this.elements.speedValue.textContent = label;
        });
    }

    showOptionsMenu(title, options, onSelect) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Create menu
        const menu = document.createElement('div');
        menu.style.cssText = `
            background: rgba(28, 28, 28, 0.98);
            border-radius: 8px;
            padding: 16px 0;
            min-width: 200px;
            max-width: 300px;
            max-height: 80%;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
            overflow-y: auto;
        `;

        // Title
        const titleEl = document.createElement('div');
        titleEl.textContent = title;
        titleEl.style.cssText = `
            padding: 8px 16px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 8px;
        `;
        menu.appendChild(titleEl);

        // Options
        options.forEach((option, index) => {
            const item = document.createElement('div');
            item.textContent = option;
            item.style.cssText = `
                padding: 12px 16px;
                color: white;
                cursor: pointer;
                transition: background 0.2s;
                font-size: 14px;
            `;
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(255, 255, 255, 0.1)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = '';
            });
            item.addEventListener('click', () => {
                onSelect(option, index);
                overlay.remove();
                this.elements.settingsMenu.classList.remove('show');
            });
            menu.appendChild(item);
        });

        overlay.appendChild(menu);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        // Attach overlay to container so it remains visible in fullscreen
        this.container.appendChild(overlay);
    }

    // Theater Mode
    toggleTheaterMode() {
        this.isTheaterMode = !this.isTheaterMode;
        this.container.classList.toggle('theater-mode');

        if (this.isTheaterMode) {
            this.elements.theaterOff.style.display = 'none';
            this.elements.theaterOn.style.display = '';
            this.showNotification('Theater mode ON');
        } else {
            this.elements.theaterOff.style.display = '';
            this.elements.theaterOn.style.display = 'none';
            this.showNotification('Theater mode OFF');
        }
    }

    // Picture-in-Picture
    async togglePiP() {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await this.video.requestPictureInPicture();
            }
        } catch (error) {
            console.error('PiP error:', error);
        }
    }

    // Fullscreen
    toggleFullscreen() {
        const isInFullscreen = this.isFullscreen();

        if (!isInFullscreen) {
            // Enter fullscreen
            this.enterFullscreen();
        } else {
            // Exit fullscreen
            this.exitFullscreen();
        }
    }

    isFullscreen() {
        return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    }

    enterFullscreen() {
        const element = this.container;

        // Ensure video object-fit is set to contain - CRITICAL for mobile
        this.video.style.objectFit = 'contain';
        this.video.style.objectPosition = 'center';
        this.video.style.width = '100vw';
        this.video.style.height = '100vh';
        this.video.style.maxWidth = '100vw';
        this.video.style.maxHeight = '100vh';
        this.video.style.position = 'absolute';
        this.video.style.top = '0';
        this.video.style.left = '0';
        this.video.style.right = '0';
        this.video.style.bottom = '0';
        this.video.style.transform = 'none';

        // Also fix container
        element.style.paddingBottom = '0';
        element.style.height = '100vh';
        element.style.width = '100vw';

        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.webkitEnterFullscreen) {
            // iOS Safari fallback
            element.webkitEnterFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }

        // Lock orientation to landscape on mobile
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(err => {
                console.log('Orientation lock not supported:', err);
            });
        }
    }

    exitFullscreen() {
        // Reset video styles
        this.video.style.width = '';
        this.video.style.height = '';
        this.video.style.maxWidth = '';
        this.video.style.maxHeight = '';
        this.video.style.position = '';
        this.video.style.top = '';
        this.video.style.left = '';
        this.video.style.right = '';
        this.video.style.bottom = '';

        // Reset container styles
        this.container.style.paddingBottom = '';
        this.container.style.height = '';
        this.container.style.width = '';

        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }

        // Unlock orientation
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    }

    onFullscreenChange() {
        if (this.isFullscreen()) {
            this.elements.fullscreenEnter.style.display = 'none';
            this.elements.fullscreenExit.style.display = '';
            this.showNotification('Fullscreen ON');
        } else {
            this.elements.fullscreenEnter.style.display = '';
            this.elements.fullscreenExit.style.display = 'none';
            this.showNotification('Fullscreen OFF');
        }
    }

    // Controls Auto-hide
    startControlsTimer() {
        this.controlsInterval = setInterval(() => {
            if (this.isPlaying && Date.now() - this.lastMouseMove > 3000) {
                this.hideControls();
            }
        }, 1000);
    }

    resetControlsTimer() {
        this.lastMouseMove = Date.now();
    }

    clearControlsTimer() {
        // Stop auto-hide when paused
        this.lastMouseMove = Date.now() + 999999; // Far future so controls stay visible
    }

    onMouseMove() {
        this.lastMouseMove = Date.now();
        this.showControls();
    }

    onTouchStart(e) {
        // Don't interfere with tap zones, control buttons, or close button
        if (e.target.closest('.youtube-tap-zone') ||
            e.target.closest('.youtube-control-btn') ||
            e.target.closest('.youtube-progress-container') ||
            e.target.closest('.youtube-close-controls') ||
            e.target.closest('.youtube-play-button')) {
            return;
        }

        this.lastMouseMove = Date.now();
        this.showControls();
    }

    onTouchMove(e) {
        // Show controls on touch move (swipe)
        this.lastMouseMove = Date.now();
        this.showControls();
    }

    onOverlayTap(e) {
        e.preventDefault();
        e.stopPropagation();

        // Single tap on center overlay to toggle controls visibility
        const now = Date.now();
        const timeSinceLastTap = now - (this.lastOverlayTap || 0);

        // If less than 300ms, it's a double tap - let double tap handler deal with it
        if (timeSinceLastTap < 300) {
            return;
        }

        this.lastOverlayTap = now;

        // Toggle controls on tap - if visible, hide them; if hidden, show them
        if (this.container.classList.contains('show-controls')) {
            this.hideControls();
        } else {
            this.showControls();
            this.resetControlsTimer();
        }
    }

    showControls() {
        this.container.classList.add('show-controls');
        this.container.style.cursor = '';
    }

    hideControls() {
        this.container.classList.remove('show-controls');
        this.container.style.cursor = 'none';
    }

    // Spinner
    showSpinner() {
        this.elements.spinner.classList.add('active');
    }

    hideSpinner() {
        this.elements.spinner.classList.remove('active');
    }

    // Notification
    showNotification(text) {
        this.elements.notification.textContent = text;
        this.elements.notification.classList.add('show');
        clearTimeout(this.notificationTimeout);
        this.notificationTimeout = setTimeout(() => {
            this.elements.notification.classList.remove('show');
        }, 1500);
    }

    // Utilities
    isTouchDevice() {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0
        );
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';

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

    // Public API
    setQuality(quality) {
        this.currentQuality = quality;
        this.elements.qualityValue.textContent = quality;

        // Update quality badge
        if (quality !== 'Auto' && quality !== 'auto') {
            this.elements.qualityBadge.textContent = quality.toUpperCase();
            this.elements.qualityBadge.style.display = '';
        } else {
            this.elements.qualityBadge.style.display = 'none';
        }

        this.showNotification(`Quality: ${quality}`);
    }

    setSpeed(speed) {
        this.video.playbackRate = speed;
        this.currentSpeed = speed;

        // Update speed value display
        if (speed === 1) {
            this.elements.speedValue.textContent = 'Normal';
        } else {
            this.elements.speedValue.textContent = speed + 'x';
        }

        this.showNotification(`Speed: ${speed}x`);
    }

    showSkipButtons() {
        this.elements.skipButtons.style.display = 'flex';
    }

    hideSkipButtons() {
        this.elements.skipButtons.style.display = 'none';
    }

    destroy() {
        clearInterval(this.controlsInterval);
        clearTimeout(this.notificationTimeout);
        // Remove all event listeners
        console.log('YouTube Player destroyed');
    }
}

// Export for use
window.YouTubePlayer = YouTubePlayer;
