function createStaleCache({ freshMs, staleMs }) {
    const state = {
        value: null,
        freshUntil: 0,
        staleUntil: 0,
        revalidating: false
    };

    async function get(loader) {
        const now = Date.now();

        if (state.value && now < state.freshUntil) {
            return { value: state.value, cache: 'hit' };
        }

        if (state.value && now < state.staleUntil) {
            if (!state.revalidating) {
                state.revalidating = true;
                loader()
                    .then((value) => {
                        state.value = value;
                        state.freshUntil = Date.now() + freshMs;
                        state.staleUntil = Date.now() + freshMs + staleMs;
                    })
                    .catch((error) => {
                        console.warn('[Cache] Background revalidation failed:', error.message);
                    })
                    .finally(() => {
                        state.revalidating = false;
                    });
            }
            return { value: state.value, cache: 'stale' };
        }

        const value = await loader();
        state.value = value;
        state.freshUntil = Date.now() + freshMs;
        state.staleUntil = Date.now() + freshMs + staleMs;
        return { value, cache: 'miss' };
    }

    function getStats() {
        return {
            hasValue: Boolean(state.value),
            freshUntil: state.freshUntil,
            staleUntil: state.staleUntil,
            revalidating: state.revalidating
        };
    }

    return { get, getStats };
}

function createResponseCache() {
    const stores = new Map();

    async function get(key, ttlMs, loader) {
        const cached = stores.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }

        const value = await loader();
        stores.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
        return value;
    }

    return { get };
}

function createKeyedStaleCache({ freshMs, staleMs, maxEntries = 200 }) {
    const stores = new Map();

    function hasCachedValue(entry) {
        return entry && entry.value !== null && entry.value !== undefined;
    }

    function touch(key, entry) {
        stores.delete(key);
        stores.set(key, entry);

        while (stores.size > maxEntries) {
            const oldestKey = stores.keys().next().value;
            stores.delete(oldestKey);
        }
    }

    async function get(key, loader) {
        const now = Date.now();
        let entry = stores.get(key);

        if (hasCachedValue(entry) && now < entry.freshUntil) {
            touch(key, entry);
            return { value: entry.value, cache: 'hit' };
        }

        if (hasCachedValue(entry) && now < entry.staleUntil) {
            if (!entry.promise) {
                entry.promise = loader()
                    .then((value) => {
                        entry.value = value;
                        entry.freshUntil = Date.now() + freshMs;
                        entry.staleUntil = Date.now() + freshMs + staleMs;
                        return value;
                    })
                    .catch((error) => {
                        console.warn(`[Cache] Background revalidation failed for ${key}:`, error.message);
                    })
                    .finally(() => {
                        entry.promise = null;
                    });
            }

            touch(key, entry);
            return { value: entry.value, cache: 'stale' };
        }

        if (entry?.promise) {
            try {
                const value = await entry.promise;
                touch(key, entry);

                if (value !== undefined) {
                    return { value, cache: 'pending' };
                }

                if (hasCachedValue(entry)) {
                    return { value: entry.value, cache: 'stale' };
                }

                return { value, cache: 'pending' };
            } catch (error) {
                if (hasCachedValue(entry)) {
                    return { value: entry.value, cache: 'stale' };
                }
                throw error;
            }
        }

        entry = {
            value: null,
            freshUntil: 0,
            staleUntil: 0,
            promise: null
        };

        entry.promise = loader()
            .then((value) => {
                entry.value = value;
                entry.freshUntil = Date.now() + freshMs;
                entry.staleUntil = Date.now() + freshMs + staleMs;
                return value;
            })
            .finally(() => {
                entry.promise = null;
            });

        stores.set(key, entry);
        const value = await entry.promise;
        touch(key, entry);
        return { value, cache: 'miss' };
    }

    function getStats() {
        return {
            size: stores.size,
            maxEntries
        };
    }

    return { get, getStats };
}

module.exports = {
    createStaleCache,
    createResponseCache,
    createKeyedStaleCache
};