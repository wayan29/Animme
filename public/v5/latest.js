// V5 Anoboy - Latest Release Page JavaScript

// App State
const appState = {
    currentPage: 1,
    animeList: [],
    hasNextPage: false,
    loading: false
};

// API Configuration
const API_BASE = '/api/v5/anoboy';

// Fetch data from API
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showError('Gagal memuat data. Silakan coba lagi.');
        throw error;
    }
}

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `<div class="error">${message}</div>`;
    errorContainer.style.display = 'block';
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 5000);
}

// Get page from URL parameter
function getPageFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('page')) || 1;
}

// Update URL with page parameter
function updateURL(page) {
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
}

// Render anime grid
function renderAnimeGrid() {
    const animeGrid = document.getElementById('animeGrid');

    if (appState.animeList.length === 0) {
        animeGrid.innerHTML = `
            <div class="loading">
                <p>Tidak ada anime yang ditemukan</p>
            </div>
        `;
        return;
    }

    animeGrid.innerHTML = appState.animeList.map(anime => `
        <a href="/v5/detail?slug=${encodeURIComponent(anime.slug)}" class="anime-card">
            <div class="anime-poster" style="background-image: url('${anime.poster || '/placeholder.jpg'}')"></div>
            <div class="anime-info">
                <div class="anime-title">${anime.title}</div>
                ${anime.type ? `<span class="anime-type">${anime.type}</span>` : ''}
            </div>
        </a>
    `).join('');
}

// Render pagination
function renderPagination() {
    const pagination = document.getElementById('pagination');
    const currentPage = appState.currentPage;
    const hasNext = appState.hasNextPage;

    let buttons = [];

    // Previous button
    const hasPrev = currentPage > 1;
    buttons.push(`
        <button class="page-btn ${!hasPrev ? 'disabled' : ''}"
                onclick="${hasPrev ? `changePage(${currentPage - 1})` : 'return false'}"
                ${!hasPrev ? 'disabled' : ''}>
            ‹ Prev
        </button>
    `);

    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(startPage + 4, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage || i === currentPage + 1 || i === currentPage - 1 || hasNext) {
            buttons.push(`
                <button class="page-btn ${i === currentPage ? 'active' : ''}"
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `);
        }
    }

    // Next button
    buttons.push(`
        <button class="page-btn ${!hasNext ? 'disabled' : ''}"
                onclick="${hasNext ? `changePage(${currentPage + 1})` : 'return false'}"
                ${!hasNext ? 'disabled' : ''}>
            Next ›
        </button>
    `);

    pagination.innerHTML = buttons.join('');
}

// Change page
function changePage(page) {
    if (page < 1 || appState.loading) return;
    appState.currentPage = page;
    updateURL(page);
    loadAnimePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Load anime for specific page
async function loadAnimePage(page) {
    if (appState.loading) return;

    try {
        appState.loading = true;
        const animeGrid = document.getElementById('animeGrid');

        // Show loading state
        animeGrid.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat anime halaman ${page}...</p>
            </div>
        `;

        console.log(`[V5] Loading latest release page: ${page}`);
        const data = await fetchAPI(`/latest?page=${page}`);

        console.log('[V5] Latest release data:', data);

        if (data.status === 'success') {
            appState.animeList = data.data.anime_list || [];
            appState.hasNextPage = data.data.has_next_page || false;
            appState.currentPage = data.data.current_page || page;

            renderAnimeGrid();
            renderPagination();
        } else {
            showError(data.message || 'Gagal memuat anime');
            animeGrid.innerHTML = `
                <div class="loading">
                    <p>Error: ${data.message || 'Gagal memuat data'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('[V5] Error loading anime:', error);
    } finally {
        appState.loading = false;
    }
}

// Search anime
function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    if (query) {
        window.location.href = `/v5/search?q=${encodeURIComponent(query)}`;
    }
}

// Handle search on Enter key
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchAnime();
            }
        });
    }
});

// Sidebar Toggle
const menuToggle = document.getElementById('menuToggle');
const menuCloseBtn = document.getElementById('menuCloseBtn');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

if (menuToggle) {
    menuToggle.addEventListener('click', function() {
        sidebar.classList.add('active');
        sidebarBackdrop.classList.add('active');
    });
}

if (menuCloseBtn) {
    menuCloseBtn.addEventListener('click', function() {
        sidebar.classList.remove('active');
        sidebarBackdrop.classList.remove('active');
    });
}

if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', function() {
        sidebar.classList.remove('active');
        sidebarBackdrop.classList.remove('active');
    });
}

// Server Select
const serverSelect = document.getElementById('serverSelect');
if (serverSelect) {
    serverSelect.addEventListener('change', function() {
        const version = this.value;
        switch(version) {
            case 'v1':
                window.location.href = '/v1/';
                break;
            case 'v2':
                window.location.href = '/v2/';
                break;
            case 'v3':
                window.location.href = '/v3/';
                break;
            case 'v4':
                window.location.href = '/v4/';
                break;
            case 'v5':
                window.location.href = '/v5/home';
                break;
        }
    });
}

// Initialize app
async function initializeApp() {
    try {
        // Get page from URL or default to 1
        const page = getPageFromURL();
        appState.currentPage = page;

        console.log(`[V5] Initializing latest release page with page: ${page}`);

        // Load anime list
        await loadAnimePage(page);
    } catch (error) {
        console.error('[V5] Initialization error:', error);
        showError('Gagal memuat halaman. Silakan refresh halaman.');
    }
}

// Start the app
initializeApp();
