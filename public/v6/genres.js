// AnimMe V6 - AnimeIndo Genres Page
const API_BASE = '/api/v6/animeindo';

const genreState = {
    genres: [],
    isLoading: false,
    error: null
};

document.addEventListener('DOMContentLoaded', () => {
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    loadGenres();
});

async function loadGenres() {
    genreState.isLoading = true;
    showLoading();
    hideError();

    try {
        const response = await fetch(`${API_BASE}/genres`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || 'Data tidak valid');
        }

        genreState.genres = Array.isArray(payload.data.genres) ? payload.data.genres : [];
        renderGenres();
    } catch (error) {
        console.error('[V6] Genres API error:', error);
        showError('Gagal memuat daftar genre.');
        renderFallback();
    } finally {
        genreState.isLoading = false;
    }
}

function renderGenres() {
    const container = document.getElementById('genreContainer');
    if (!container) return;

    if (!genreState.genres.length) {
        container.innerHTML = `
            <div class="error" style="background: rgba(52,152,219,0.12);color:rgba(226,239,255,0.75);border-radius:10px;">
                Belum ada genre yang tersedia.
            </div>
        `;
        return;
    }

    const groups = groupGenresByLetter(genreState.genres);

    container.innerHTML = '';
    Object.entries(groups).forEach(([letter, items]) => {
        const section = document.createElement('section');
        section.className = 'letter-section';

        const title = document.createElement('h3');
        title.className = 'section-title';
        title.textContent = letter;

        const grid = document.createElement('div');
        grid.className = 'genre-grid';

        items.forEach((genre) => {
            const link = document.createElement('a');
            link.className = 'genre-card';
            link.textContent = genre.name || 'Tidak diketahui';
            if (genre.slug) {
                const params = new URLSearchParams();
                params.set('slug', genre.slug.replace(/^genres\//i, '').replace(/^anime\//i, ''));
                params.set('name', genre.name);
                link.href = `/v6/genre?${params.toString()}`;
            } else {
                link.href = genre.url || '#';
                if (genre.url) {
                    link.target = '_blank';
                    link.rel = 'noopener';
                }
            }
            grid.appendChild(link);
        });

        section.appendChild(title);
        section.appendChild(grid);
        container.appendChild(section);
    });
}

function groupGenresByLetter(genres) {
    const map = {};
    genres.forEach((genre) => {
        const letter = genre.name ? genre.name.trim().charAt(0).toUpperCase() : '#';
        const key = /[A-Z]/.test(letter) ? letter : '#';
        if (!map[key]) map[key] = [];
        map[key].push(genre);
    });

    return Object.keys(map)
        .sort()
        .reduce((acc, key) => {
            acc[key] = map[key].sort((a, b) => a.name.localeCompare(b.name));
            return acc;
        }, {});
}

function renderFallback() {
    const container = document.getElementById('genreContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="error">
            Tidak dapat menampilkan daftar genre.
        </div>
    `;
}

function showLoading() {
    const container = document.getElementById('genreContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Memuat daftar genre...</p>
        </div>
    `;
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
    errorContainer.style.display = 'block';
    genreState.error = message;
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    genreState.error = null;
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

console.log('[V6] AnimeIndo genre page initialized');
