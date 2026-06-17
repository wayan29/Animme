// AnimMe V6 - AnimeIndo Anime List Page
const API_BASE = '/api/v6/animeindo';

const appState = {
    sections: [],
    availableLetters: [],
    activeLetter: 'ALL',
    totalCount: 0,
    allTotal: 0,
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
});

async function initializePage() {
    try {
        await loadAnimeList('ALL');
    } catch (error) {
        console.error('[V6] Failed to initialize anime list:', error);
        showError('Terjadi kesalahan saat memuat data anime list.');
    }
}

async function loadAnimeList(letter = 'ALL') {
    appState.isLoading = true;
    hideError();
    showLoadingState();

    try {
        const response = await fetch(`${API_BASE}/anime-list?letter=${encodeURIComponent(letter)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Respon server tidak valid');
        }

        const { sections, anime_list, available_letters, letter: activeLetter, total, all_total } = payload.data;

        appState.sections = Array.isArray(sections) ? sections : [];
        appState.availableLetters = Array.isArray(available_letters) ? available_letters : ['ALL'];
        appState.activeLetter = activeLetter || 'ALL';
        appState.totalCount = typeof total === 'number' ? total : anime_list?.length || 0;
        appState.allTotal = typeof all_total === 'number' ? all_total : appState.totalCount;

        renderLetterFilter();
        renderAnimeList();
        renderStats();
    } catch (error) {
        console.error('[V6] Anime list API error:', error);
        showError('Gagal memuat daftar anime dari AnimeIndo.');
        showFallbackState();
    } finally {
        appState.isLoading = false;
    }
}

function renderStats() {
    const totalCountEl = document.getElementById('totalCount');
    const activeLetterEl = document.getElementById('activeLetter');

    if (totalCountEl) {
        totalCountEl.textContent = `${appState.totalCount} / ${appState.allTotal}`;
    }
    if (activeLetterEl) {
        activeLetterEl.textContent = appState.activeLetter;
    }
}

function renderLetterFilter() {
    const container = document.getElementById('letterFilter');
    if (!container) return;

    container.innerHTML = '';

    const letters = appState.availableLetters.includes('ALL')
        ? appState.availableLetters
        : ['ALL', ...appState.availableLetters];

    letters.forEach(letter => {
        const button = document.createElement('button');
        button.textContent = letter;
        if (letter === appState.activeLetter) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            if (appState.isLoading || appState.activeLetter === letter) return;
            loadAnimeList(letter);
        });
        container.appendChild(button);
    });
}

function renderAnimeList() {
    const container = document.getElementById('animeListContainer');
    if (!container) return;

    if (!appState.sections.length) {
        container.innerHTML = `
            <div class="loading">
                <p>Tidak ada anime yang ditemukan untuk huruf ini.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    appState.sections.forEach(section => {
        const sectionWrapper = document.createElement('section');
        sectionWrapper.className = 'letter-section';

        const title = document.createElement('h3');
        title.className = 'letter-title';
        title.textContent = section.letter || 'Tidak Diketahui';
        sectionWrapper.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'anime-list-grid';

        section.anime_list.forEach(anime => {
            const item = document.createElement('div');
            item.className = 'anime-list-item';

            const link = document.createElement('a');
            if (anime.slug) {
                const detailSlug = anime.slug.startsWith('anime/') ? anime.slug : `anime/${anime.slug}`;
                link.href = `/v6/detail?slug=${encodeURIComponent(detailSlug)}`;
            } else {
                link.href = anime.url || '#';
                link.target = '_blank';
                link.rel = 'noopener';
            }
            link.textContent = anime.title || 'Judul tidak tersedia';

            item.appendChild(link);
            grid.appendChild(item);
        });

        sectionWrapper.appendChild(grid);
        container.appendChild(sectionWrapper);
    });
}

function showLoadingState() {
    const container = document.getElementById('animeListContainer');
    const letterFilter = document.getElementById('letterFilter');

    if (container) {
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat daftar anime dari AnimeIndo...</p>
            </div>
        `;
    }

    if (letterFilter && !letterFilter.querySelector('button')) {
        letterFilter.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat daftar huruf...</p>
            </div>
        `;
    }
}

function showFallbackState() {
    const container = document.getElementById('animeListContainer');
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <p>Tidak dapat menampilkan daftar anime.</p>
            </div>
        `;
    }
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;

    errorContainer.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
    errorContainer.style.display = 'block';
    appState.error = message;
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;

    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    appState.error = null;
}

function escapeHtml(text = '') {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!menuToggle || !sidebar) return;

    const openSidebar = () => {
        sidebar.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
        document.body.classList.add('sidebar-open');
    };

    const closeSidebar = () => {
        sidebar.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';
    };

    menuToggle.addEventListener('click', openSidebar);

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', closeSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchInput = document.getElementById('searchInput');
    const searchContainer = document.querySelector('.search-container');

    if (!searchIconBtn || !searchContainer) return;

    searchIconBtn.addEventListener('click', () => {
        searchContainer.classList.add('active');
        if (searchInput) searchInput.focus();
    });

    if (searchCloseBtn) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer.classList.remove('active');
            if (searchInput) searchInput.value = '';
        });
    }
}

function setupSearchHandler() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    if (searchBtn) {
        searchBtn.addEventListener('click', searchAnime);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                searchAnime();
            }
        });
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (!query) return;

    window.location.href = `/v6/search?q=${encodeURIComponent(query)}`;
}

function setupServerSelector() {
    const selector = document.getElementById('serverSelect');
    if (!selector) return;

    selector.value = 'v6';

    selector.addEventListener('change', (event) => {
        const version = event.target.value;
        switch (version) {
            case 'v1':
                window.location.href = '/v1/home';
                break;
            case 'v2':
                window.location.href = '/v2/home';
                break;
            case 'v3':
                window.location.href = '/v3/home';
                break;
            case 'v4':
                window.location.href = '/v4/home';
                break;
            case 'v5':
                window.location.href = '/v5/home';
                break;
            case 'v6':
                window.location.href = '/v6/home';
                break;
            default:
                window.location.href = '/';
        }
    });
}

console.log('[V6] AnimeIndo anime list page initialized');
