// AnimMe V7 - Nekopoi A-Z List Application
const API_BASE = '/api/v7/nekopoi';

const appState = {
    fullData: null,
    currentLetter: '',
    isLoading: false,
    error: null,
    listType: 'hentai'
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    setupAllButton();
    setupSectionGlobalControls();
    setupHistorySync();
});

async function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const letter = urlParams.get('letter') || '';
    appState.listType = window.location.pathname.includes('jav-list') ? 'jav' : 'hentai';
    updateListChrome();

    try {
        await loadAnimeList(letter);
    } catch (error) {
        console.error('[V7] Failed to initialize list:', error);
        showError('Terjadi kesalahan saat memuat daftar anime.');
    }
}

async function loadAnimeList(letter = '') {
    appState.isLoading = true;
    appState.currentLetter = letter;
    hideError();
    showLoadingState();

    try {
        const endpoint = appState.listType === 'jav' ? 'jav-list' : 'hentai-list';
        const url = letter ?
            `${API_BASE}/${endpoint}?letter=${encodeURIComponent(letter)}` :
            `${API_BASE}/${endpoint}`;

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
        updateToolbarVisibility();
    } catch (error) {
        console.error('[V7] A-Z list API error:', error);
        showError('Gagal memuat daftar dari Nekopoi.');
        renderFallbackState();
    } finally {
        appState.isLoading = false;
    }
}

function updateListChrome() {
    const isJav = appState.listType === 'jav';
    const title = document.querySelector('.list-title');
    const topbar = document.querySelector('.topbar-title');
    const activeHref = isJav ? '/v7/jav-list' : '/v7/list';

    document.title = isJav ? 'AnimMe V7 - JAV List' : 'AnimMe V7 - Hentai List';
    if (title) title.textContent = isJav ? '🎬 JAV List A-Z' : '📚 Hentai List A-Z';
    if (topbar) topbar.textContent = isJav ? 'AnimMe V7 - JAV List' : 'AnimMe V7 - Hentai List';
    document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === activeHref);
    });
}

function renderLetterNavigation() {
    if (!appState.fullData || !appState.fullData.letters) return;

    const navContainer = document.getElementById('letterNavigation');
    if (!navContainer) return;

    // Keep "Semua" button
    const allBtn = navContainer.querySelector('.all-btn');
    if (allBtn) {
        const isAllActive = appState.currentLetter === '';
        allBtn.classList.toggle('active', isAllActive);
        if (isAllActive) allBtn.setAttribute('aria-current', 'true');
        else allBtn.removeAttribute('aria-current');
    }

    // Add letter buttons (compact label + count)
    appState.fullData.letters.forEach(letterData => {
        const existingBtn = navContainer.querySelector(`[data-letter="${CSS.escape(letterData.letter)}"]`);
        if (!existingBtn) {
            const btn = document.createElement('button');
            btn.className = 'letter-btn';
            btn.type = 'button';
            btn.setAttribute('data-letter', letterData.letter);
            btn.setAttribute('title', `${letterData.letter} - ${letterData.count} item`);
            btn.setAttribute('aria-label', `Huruf ${letterData.letter}, ${letterData.count} item`);
            btn.innerHTML = `<span class="letter-label">${escapeHtml(letterData.letter)}</span><span class="letter-count">${letterData.count}</span>`;
            btn.addEventListener('click', () => filterByLetter(letterData.letter));
            navContainer.appendChild(btn);
        }
    });

    // Activate current letter button
    const letterBtns = navContainer.querySelectorAll('.letter-btn:not(.all-btn)');
    letterBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-letter') === appState.currentLetter;
        btn.classList.toggle('active', isActive);
        if (isActive) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
    });
}

function filterByLetter(letter) {
    // If the page was loaded as a single-letter deep link, reload full data when returning to Semua.
    if (!letter && appState.fullData?.letters?.length === 1) {
        const url = new URL(window.location);
        url.searchParams.delete('letter');
        window.history.pushState({}, '', url);
        loadAnimeList('');
        return;
    }

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
            const isActive = btnLetter === letter;
            btn.classList.toggle('active', isActive);
            if (isActive) btn.setAttribute('aria-current', 'true');
            else btn.removeAttribute('aria-current');
        });
    }

    renderAnimeList();
    updateStats();
    updateToolbarVisibility();

    // Scroll konten ke atas agar tidak tersesat setelah ganti huruf
    const main = document.querySelector('.main-content');
    if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        // Show all anime grouped by letter (collapsed by default to keep page short)
        if (appState.fullData.letters && appState.fullData.letters.length > 0) {
            appState.fullData.letters.forEach(letterData => {
                if (letterData.anime && letterData.anime.length > 0) {
                    const section = document.createElement('section');
                    section.className = 'letter-section collapsed';
                    section.id = `letter-${letterData.letter}`;
                    section.setAttribute('data-letter', letterData.letter);

                    const title = document.createElement('button');
                    title.className = 'letter-section-title';
                    title.type = 'button';
                    title.setAttribute('aria-expanded', 'false');
                    title.innerHTML = `
                        <span class="letter-toggle-mark" aria-hidden="true">▾</span>
                        <span class="letter-toggle-label">${escapeHtml(letterData.letter)}</span>
                        <span class="letter-toggle-count">${letterData.count} item</span>
                    `;
                    title.addEventListener('click', () => toggleSection(section, title));

                    const panel = document.createElement('div');
                    panel.className = 'letter-section-panel';

                    const grid = document.createElement('div');
                    grid.className = 'anime-grid';
                    panel.appendChild(grid);

                    section._animeData = letterData.anime;
                    section._rendered = false;

                    section.appendChild(title);
                    section.appendChild(panel);
                    container.appendChild(section);
                }
            });
            updateToolbarVisibility();
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
                <p>Tidak ada anime ditemukan untuk huruf "${escapeHtml(appState.currentLetter)}".</p>
            </div>
        `;
    }
}

function toggleSection(section, titleBtn) {
    const collapsed = section.classList.toggle('collapsed');
    titleBtn.setAttribute('aria-expanded', String(!collapsed));

    if (!collapsed) {
        renderSectionCards(section);
    }
}

function renderSectionCards(section) {
    if (!section || section._rendered) return;
    const grid = section.querySelector('.anime-grid');
    const animeList = Array.isArray(section._animeData) ? section._animeData : [];
    if (!grid) return;

    animeList.forEach(anime => grid.appendChild(createAnimeCard(anime)));
    section._rendered = true;
}

function setAllSectionsCollapsed(collapsed) {
    document.querySelectorAll('.letter-section').forEach(section => {
        section.classList.toggle('collapsed', collapsed);
        const titleBtn = section.querySelector('.letter-section-title');
        if (titleBtn) titleBtn.setAttribute('aria-expanded', String(!collapsed));
        if (!collapsed) renderSectionCards(section);
    });
}

function setupSectionGlobalControls() {
    document.getElementById('expandAllBtn')?.addEventListener('click', () => setAllSectionsCollapsed(false));
    document.getElementById('collapseAllBtn')?.addEventListener('click', () => setAllSectionsCollapsed(true));
}

function setupHistorySync() {
    window.addEventListener('popstate', () => {
        const letter = new URLSearchParams(window.location.search).get('letter') || '';
        if (letter && appState.fullData?.letters?.length === 1 && appState.fullData.letters[0]?.letter !== letter) {
            loadAnimeList(letter);
            return;
        }
        if (!letter && appState.fullData?.letters?.length === 1) {
            loadAnimeList('');
            return;
        }
        appState.currentLetter = letter;
        renderLetterNavigation();
        renderAnimeList();
        updateStats();
        updateToolbarVisibility();
    });
}

function createAnimeCard(anime) {
    const card = document.createElement('a');
    card.className = 'anime-item';
    card.href = `/v7/detail?slug=${encodeURIComponent(anime.slug)}`;

    const initial = (anime.letter || anime.title || '?').charAt(0).toUpperCase();
    const typeLabel = appState.listType === 'jav' ? 'JAV' : 'Hentai';

    card.innerHTML = `
        <span class="anime-initial" aria-hidden="true">${escapeHtml(initial)}</span>
        <span class="anime-card-body">
            <h3 class="anime-title">${escapeHtml(anime.title)}</h3>
            <span class="anime-meta">
                <span class="anime-chip anime-chip-type">${escapeHtml(typeLabel)}</span>
                <span class="anime-action">Detail →</span>
            </span>
        </span>
        <span class="anime-letter" aria-hidden="true">${escapeHtml(anime.letter || '')}</span>
    `;

    return card;
}

function updateStats() {
    const statsContainer = document.getElementById('listStats');
    if (!statsContainer || !appState.fullData) return;

    const totalLetters = appState.fullData.letters?.length || 0;

    if (appState.currentLetter) {
        const letterData = appState.fullData.letters.find(l => l.letter === appState.currentLetter);
        const count = letterData ? letterData.count : 0;
        statsContainer.textContent = `${count} item • Huruf ${appState.currentLetter}`;
    } else {
        const total = appState.fullData.totalAnime || 0;
        statsContainer.textContent = `${total.toLocaleString('id-ID')} item • ${totalLetters} grup A-Z`;
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
            v7: '/v7/home',
            v8: '/v8/home',
            v9: '/v9/home',
            v10: '/v10/home'
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
        document.body.classList.add('sidebar-open');
    };

    const closeSidebar = () => {
        sidebar?.classList.remove('active');
        backdrop?.classList.remove('active');
        document.body.classList.remove('sidebar-open');
    };

    menuToggle?.addEventListener('click', openSidebar);
    menuCloseBtn?.addEventListener('click', closeSidebar);
    backdrop?.addEventListener('click', closeSidebar);

    // Close sidebar when clicking nav links
    sidebarLinks.forEach(link => {
        link.addEventListener('click', closeSidebar);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        }
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

// Setup "Semua" button handler (dipanggil sekali setelah DOM ready)

function updateToolbarVisibility() {
    const hasSections = document.querySelectorAll('.letter-section').length > 0;
    const expand = document.getElementById('expandAllBtn');
    const collapse = document.getElementById('collapseAllBtn');
    if (expand) expand.hidden = !hasSections;
    if (collapse) collapse.hidden = !hasSections;
}

function setupAllButton() {
    const allBtn = document.querySelector('.letter-btn.all-btn');
    if (allBtn) {
        allBtn.addEventListener('click', () => filterByLetter(''));
    }
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
