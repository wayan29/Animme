// V5 Anoboy - A-Z List Page JavaScript

// App State
const appState = {
    currentLetter: 'A',
    animeList: [],
    alphabetNav: [],
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

// Get letter from URL parameter
function getLetterFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('letter') || 'A';
}

// Update URL with letter parameter
function updateURL(letter) {
    const url = new URL(window.location);
    url.searchParams.set('letter', letter);
    window.history.pushState({}, '', url);
}

// Render alphabet navigation
function renderAlphabetNav() {
    const alphabetNav = document.getElementById('alphabetNav');

    if (appState.alphabetNav.length === 0) {
        // Generate default alphabet if not provided by API
        const letters = ['#', '0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
        appState.alphabetNav = letters.map(letter => ({
            letter: letter,
            value: letter,
            active: letter === appState.currentLetter
        }));
    }

    alphabetNav.innerHTML = appState.alphabetNav.map(item => `
        <a href="#"
           class="letter-btn ${item.letter === appState.currentLetter ? 'active' : ''}"
           data-letter="${item.letter}"
           onclick="handleLetterClick(event, '${item.letter}')">
            ${item.letter}
        </a>
    `).join('');
}

// Render anime grid
function renderAnimeGrid() {
    const animeGrid = document.getElementById('animeGrid');
    const listTitle = document.getElementById('listTitle');
    const animeCount = document.getElementById('animeCount');

    // Update title and count
    listTitle.textContent = `Anime List - ${appState.currentLetter}`;
    animeCount.textContent = appState.animeList.length;

    if (appState.animeList.length === 0) {
        animeGrid.innerHTML = `
            <div class="loading">
                <p>Tidak ada anime yang ditemukan untuk huruf ${appState.currentLetter}</p>
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

// Handle letter button click
function handleLetterClick(event, letter) {
    event.preventDefault();
    if (appState.loading || letter === appState.currentLetter) {
        return;
    }

    appState.currentLetter = letter;
    updateURL(letter);
    loadAnimeList(letter);
}

// Load anime list for specific letter
async function loadAnimeList(letter) {
    if (appState.loading) return;

    try {
        appState.loading = true;
        const animeGrid = document.getElementById('animeGrid');

        // Show loading state
        animeGrid.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Memuat anime list...</p>
            </div>
        `;

        console.log(`[V5] Loading anime list for letter: ${letter}`);
        const data = await fetchAPI(`/azlist?letter=${encodeURIComponent(letter)}`);

        console.log('[V5] A-Z List data:', data);

        if (data.status === 'success') {
            appState.animeList = data.data.anime_list || [];
            appState.alphabetNav = data.data.alphabet_nav || [];
            appState.currentLetter = data.data.current_letter || letter;

            renderAlphabetNav();
            renderAnimeGrid();
        } else {
            showError(data.message || 'Gagal memuat anime list');
            animeGrid.innerHTML = `
                <div class="loading">
                    <p>Error: ${data.message || 'Gagal memuat data'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('[V5] Error loading anime list:', error);
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
        // Get letter from URL or default to 'A'
        const letter = getLetterFromURL();
        appState.currentLetter = letter;

        console.log(`[V5] Initializing A-Z list page with letter: ${letter}`);

        // Load anime list
        await loadAnimeList(letter);
    } catch (error) {
        console.error('[V5] Initialization error:', error);
        showError('Gagal memuat halaman. Silakan refresh halaman.');
    }
}

// Start the app
initializeApp();
