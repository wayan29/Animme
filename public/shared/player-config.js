// AnimMe Player Configuration Manager
// This file manages player settings across all versions

const ANIMME_PLAYER_SETTINGS_KEY = 'animme_player_settings';

// Default player settings
const defaultPlayerSettings = {
    language: 'id',
    fontFamily: 'Rubik',
    primaryColor: '#ff7755',
    captionTextColor: '#ffffff',
    captionBgColor: '#000000',
    captionSize: 20,
    controls: {
        enabled: true,
        backward10: true,
        forward10: true,
        airplay: true,
        bigPlayButton: true,
        captions: true,
        chromecast: false,
        currentTime: true,
        duration: true,
        fullscreen: true,
        mute: true,
        pip: true,
        play: true,
        progress: true,
        settings: true,
        volume: true
    },
    playbackSpeeds: [0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 3.00, 4.00],
    defaultQuality: 'auto', // auto, 360, 480, 720, 1080
    heatmap: false,
    resumable: false,
    customCSS: ''
};

// Player Configuration Manager
const PlayerConfig = {
    /**
     * Load player settings from localStorage
     * @returns {Object} Player settings
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem(ANIMME_PLAYER_SETTINGS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...defaultPlayerSettings, ...parsed };
            }
        } catch (error) {
            console.error('Error loading player settings:', error);
        }
        return defaultPlayerSettings;
    },

    /**
     * Save player settings to localStorage
     * @param {Object} settings - Player settings to save
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(ANIMME_PLAYER_SETTINGS_KEY, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Error saving player settings:', error);
            return false;
        }
    },

    /**
     * Get a specific setting value
     * @param {string} key - Setting key (use dot notation for nested keys, e.g., 'controls.backward10')
     * @returns {*} Setting value
     */
    getSetting(key) {
        const settings = this.loadSettings();
        const keys = key.split('.');
        let value = settings;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return undefined;
            }
        }

        return value;
    },

    /**
     * Apply custom CSS from settings to the page
     */
    applyCustomCSS() {
        const customCSS = this.getSetting('customCSS');
        if (customCSS && customCSS.trim()) {
            const styleElement = document.createElement('style');
            styleElement.id = 'animme-custom-player-css';
            styleElement.textContent = customCSS;
            document.head.appendChild(styleElement);
        }
    },

    /**
     * Apply primary color to CSS variables
     */
    applyPrimaryColor() {
        const primaryColor = this.getSetting('primaryColor') || '#ff7755';
        document.documentElement.style.setProperty('--player-primary-color', primaryColor);
    },

    /**
     * Apply font family to player
     */
    applyFontFamily() {
        const fontFamily = this.getSetting('fontFamily') || 'Rubik';
        document.documentElement.style.setProperty('--player-font-family', fontFamily);
    },

    /**
     * Get resumable position for a specific episode
     * @param {string} episodeId - Unique episode identifier
     * @returns {number} Last saved position in seconds
     */
    getResumePosition(episodeId) {
        if (!this.getSetting('resumable')) {
            return 0;
        }

        try {
            const positions = JSON.parse(localStorage.getItem('animme_resume_positions') || '{}');
            return positions[episodeId] || 0;
        } catch (error) {
            console.error('Error getting resume position:', error);
            return 0;
        }
    },

    /**
     * Save resumable position for a specific episode
     * @param {string} episodeId - Unique episode identifier
     * @param {number} position - Current position in seconds
     */
    saveResumePosition(episodeId, position) {
        if (!this.getSetting('resumable')) {
            return;
        }

        try {
            const positions = JSON.parse(localStorage.getItem('animme_resume_positions') || '{}');
            positions[episodeId] = position;
            localStorage.setItem('animme_resume_positions', JSON.stringify(positions));
        } catch (error) {
            console.error('Error saving resume position:', error);
        }
    },

    /**
     * Initialize player settings on page load
     * Applies CSS, colors, and fonts
     */
    initialize() {
        this.applyCustomCSS();
        this.applyPrimaryColor();
        this.applyFontFamily();

        console.log('Player config initialized');
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PlayerConfig.initialize());
} else {
    PlayerConfig.initialize();
}
