(function initAnimMeOPlayer(global) {
    let oplayerInstance = null;

    function isAvailable() {
        return typeof global.OPlayer === 'function' && typeof global.OUI === 'function';
    }

    function destroyOPlayer() {
        if (oplayerInstance && typeof oplayerInstance.destroy === 'function') {
            oplayerInstance.destroy();
        }
        oplayerInstance = null;
    }

    function pickBestSource(resolvedData) {
        const sources = Array.isArray(resolvedData?.sources) ? resolvedData.sources : [];
        if (!sources.length) return null;
        const preferred = sources.find((source) => source?.url) || sources[0];
        return preferred?.url || null;
    }

    function createOPlayer(container, url, options = {}) {
        if (!container || !url || !isAvailable()) {
            return null;
        }

        destroyOPlayer();
        container.replaceChildren();

        const player = global.OPlayer.make(container, {
            source: { src: url },
            autoplay: Boolean(options.autoplay),
            preload: options.preload || 'metadata',
            playsinline: true
        });

        player.use([
            global.OUI({
                theme: {
                    primaryColor: options.primaryColor || '#e50914',
                    progress: { position: 'top', mini: true },
                    controller: {
                        setting: 'auto',
                        display: 'always',
                        coverButton: false,
                        displayBehavior: 'hover'
                    }
                },
                fullscreen: true,
                autoFocus: true,
                keyboard: { focused: true },
                settings: ['loop'],
                speeds: ['2.0', '1.5', '1.25', '1.0', '0.75']
            })
        ]);

        player.create();
        oplayerInstance = player;
        return player;
    }

    global.AnimMeOPlayer = {
        isAvailable,
        destroyOPlayer,
        pickBestSource,
        createOPlayer,
        getInstance() {
            return oplayerInstance;
        }
    };
})(window);