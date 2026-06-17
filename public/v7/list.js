// AnimMe V7 - Nekopoi Hentai List Application
const API_BASE = '/api/v7/nekopoi';

const appState = {
    fullData: null,
    currentLetter: '',
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
});

async function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const letter = urlParams.get('letter') || '';

    try {
        await loadHentaiList(letter);
    } catch (error) {
        console.error('[V7] Failed to initialize list:', error);
        showError('Terjadi kesalahan saat memuat daftar anime.');
    }
}

async function loadHentaiList(letter = '') {
    appState.isLoading = true;
    appState.currentLetter = letter;
    hideError();
    showLoadingState();

    try {
        const url = letter ?
            `${API_BASE}/hentai-list?letter=${encodeURIComponent(letter)}` :
            `${API_BASE}/hentai-list`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Respon dari server tidak valid');
        }

        if (letter) {
            // Single letter response
            appState.fullData = {
                totalAnime: payload.data.count,
                letters: [{ letter: payload.data.letter, count: payload.data.count, anime: payload.data.anime }],
                allAnime: payload.data.anime
            };
        } else {
            // Full list response
            appState.fullData = payload.data;
        }

        renderLetterNavigation();
        renderAnimeList();
        updateStats();
    } catch (error) {
        console.error('[V7] Hentai list API error:', error);
        showError('Gagal memuat daftar anime dari Nekopoi.');
        renderFallbackState();
    } finally {
        appState.isLoading = false;
    }
}

function renderLetterNavigation() {
    if (!appState.fullData || !appState.fullData.letters) return;

    const navContainer = document.getElementById('letterNavigation');
    if (!navContainer) return;

    // Keep "Semua" button
    const allBtn = navContainer.querySelector('.all-btn');
    if (allBtn) {
        allBtn.classList.toggle('active', appState.currentLetter === '');
    }

    // Add letter buttons
    appState.fullData.letters.forEach(letterData => {
        const existingBtn = navContainer.querySelector(`[data-letter="${letterData.letter}"]`);
        if (!existingBtn) {
            const btn = document.createElement('button');
            btn.className = 'letter-btn';
            btn.setAttribute('data-letter', letterData.letter);
            btn.textContent = `${letterData.letter} (${letterData.count})`;
            btn.addEventListener('click', () => filterByLetter(letterData.letter));
            navContainer.appendChild(btn);
        }
    });

    // Activate current letter button
    const letterBtns = navContainer.querySelectorAll('.letter-btn:not(.all-btn)');
    letterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-letter') === appState.currentLetter);
    });
}

function filterByLetter(letter) {
    appState.currentLetter = letter;

    // Update URL without reload
    const url = new URL(window.location);
    if (letter) {
        url.searchParams.set('letter', letter);
    } else {
        url.searchParams.delete('letter');
    }
    window.history.pushState({}, '', url);

    // Update active button
    const navContainer = document.getElementById('letterNavigation');
    if (navContainer) {
        const allBtns = navContainer.querySelectorAll('.letter-btn');
        allBtns.forEach(btn => {
            const btnLetter = btn.getAttribute('data-letter') || '';
            btn.classList.toggle('active', btnLetter === letter);
        });
    }

    renderAnimeList();
    updateStats();
}

function renderAnimeList() {
    const container = document.getElementById('listContent');
    if (!container || !appState.fullData) return;

    container.innerHTML = '';

    let animeToDisplay = [];

    if (appState.currentLetter) {
        // Filter by specific letter
        const letterData = appState.fullData.letters.find(l => l.letter === appState.currentLetter);
        if (letterData && letterData.anime) {
            animeToDisplay = letterData.anime;
        }
    } else {
        // Show all anime grouped by letter
        if (appState.fullData.letters && appState.fullData.letters.length > 0) {
            appState.fullData.letters.forEach(letterData => {
                if (letterData.anime && letterData.anime.length > 0) {
                    const section = document.createElement('div');
                    section.className = 'letter-section';

                    const title = document.createElement('h2');
                    title.className = 'letter-section-title';
                    title.textContent = `${letterData.letter} (${letterData.count})`;
                    section.appendChild(title);

                    const grid = document.createElement('div');
                    grid.className = 'anime-grid';

                    letterData.anime.forEach(anime => {
                        const card = createAnimeCard(anime);
                        grid.appendChild(card);
                    });

                    section.appendChild(grid);
                    container.appendChild(section);
                }
            });
            return;
        }

        // Fallback to allAnime
        animeToDisplay = appState.fullData.allAnime || [];
    }

    // Render single letter view or fallback
    if (animeToDisplay.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'anime-grid';

        animeToDisplay.forEach(anime => {
            const card = createAnimeCard(anime);
            grid.appendChild(card);
        });

        container.appendChild(grid);
    } else {
        container.innerHTML = `
            <div class="loading">
                <p>Tidak ada anime ditemukan untuk huruf "${appState.currentLetter}".</p>
            </div>
        `;
    }
}

function createAnimeCard(anime) {
    const card = document.createElement('a');
    card.className = 'anime-item';
    card.href = `/v7/detail?slug=${encodeURIComponent(anime.slug)}`;

    card.innerHTML = `
        <div class="anime-title">${escapeHtml(anime.title)}</div>
        <div class="anime-letter">📑 Huruf: ${escapeHtml(anime.letter)}</div>
    `;

    return card;
}

function updateStats() {
    const statsContainer = document.getElementById('listStats');
    if (!statsContainer || !appState.fullData) return;

    if (appState.currentLetter) {
        const letterData = appState.fullData.letters.find(l => l.letter === appState.currentLetter);
        const count = letterData ? letterData.count : 0;
        statsContainer.textContent = `${count} anime (Huruf: ${appState.currentLetter})`;
    } else {
        statsContainer.textContent = `Total: ${appState.fullData.totalAnime} anime`;
    }
}

function showLoadingState() {
    const content = document.getElementById('listContent');
    if (content) {
        content.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat daftar anime...</p>
            </div>
        `;
    }
}

function renderFallbackState() {
    const container = document.getElementById('listContent');
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <p>Gagal memuat daftar anime. Silakan coba lagi nanti.</p>
                <a href="/v7/home" class="letter-btn" style="margin-top: 1rem; display: inline-block;">← Kembali ke Beranda</a>
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

// Setup "Semua" button handler
document.addEventListener('DOMContentLoaded', () => {
    const allBtn = document.querySelector('.letter-btn.all-btn');
    if (allBtn) {
        allBtn.addEventListener('click', () => filterByLetter(''));
    }
});

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
