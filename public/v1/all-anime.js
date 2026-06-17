// Server configuration
let currentServer = localStorage.getItem('selectedServer') || 'v1';
let API_BASE = currentServer === 'v2' ? '/api/v2' : '/api';
let currentPage = 1;
let paginationData = null;
const SUPPORTED_SERVERS = new Set(['v1', 'v2']);
let mobileFiltersInitialized = false;

function redirectToVersionPage(server) {
    const targetPath = server === 'v3' ? '/v3/animelist'
        : server === 'v4' ? '/v4/home'
        : '/v1/home';
    window.location.href = targetPath;
}

function updateMobileFilterVisibility() {
    const filters = document.getElementById('animeFilters');
    const toggle = document.getElementById('mobileFilterToggle');

    if (!filters || !toggle) {
        return;
    }

    const shouldShowToggle = window.innerWidth <= 768 &&
        !filters.classList.contains('hidden') &&
        currentServer === 'v2';

    if (shouldShowToggle) {
        toggle.classList.remove('hidden');
        const isOpen = filters.classList.contains('mobile-open');
        toggle.classList.toggle('active', isOpen);
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    } else {
        toggle.classList.add('hidden');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        filters.classList.remove('mobile-open');
    }
}

function initMobileFilters() {
    if (mobileFiltersInitialized) {
        return;
    }

    const filters = document.getElementById('animeFilters');
    const toggle = document.getElementById('mobileFilterToggle');

    if (!filters || !toggle) {
        return;
    }

    const applyLayout = () => {
        const shouldCollapse = window.innerWidth <= 768;
        if (shouldCollapse) {
            filters.classList.add('mobile-collapsible');
            if (!filters.classList.contains('mobile-open')) {
                filters.classList.remove('mobile-open');
            }
        } else {
            filters.classList.remove('mobile-collapsible');
            filters.classList.remove('mobile-open');
            toggle.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
        }
    };

    toggle.addEventListener('click', () => {
        if (filters.classList.contains('hidden')) {
            return;
        }

        const isOpen = filters.classList.toggle('mobile-open');
        toggle.classList.toggle('active', isOpen);
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

        if (isOpen) {
            filters.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    window.addEventListener('resize', () => {
        applyLayout();
        updateMobileFilterVisibility();
    });

    applyLayout();
    updateMobileFilterVisibility();
    mobileFiltersInitialized = true;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const serverParam = urlParams.get('server');
    const genreParam = urlParams.get('genre');
    
    // Override server if specified in URL
    if (serverParam) {
        currentServer = serverParam;
        localStorage.setItem('selectedServer', serverParam);
        API_BASE = serverParam === 'v2' ? '/api/v2' : '/api';
    }
    
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = currentServer;
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }
    
    if (!SUPPORTED_SERVERS.has(currentServer)) {
        redirectToVersionPage(currentServer);
        return;
    }

    applyServerClass(currentServer);
    initMobileFilters();
    updateMobileFilterVisibility();
    
    // Pre-fill genre filter if specified in URL
    if (genreParam && currentServer === 'v2') {
        setTimeout(() => {
            const genreCheckbox = document.querySelector(`input[name="genre"][value="${genreParam}"]`);
            if (genreCheckbox) {
                genreCheckbox.checked = true;
                updateGenreButtonText();
            }
        }, 100);
    }
    
    loadAllAnimePage();
});

function applyServerClass(server) {
    document.body.classList.remove('server-v1', 'server-v2', 'server-v3', 'server-v4');
    const className = server === 'v2' ? 'server-v2' : (server === 'v3' ? 'server-v3' : (server === 'v4' ? 'server-v4' : 'server-v1'));
    document.body.classList.add(className);
}

function changeServer(server) {
    currentServer = server;
    localStorage.setItem('selectedServer', server);
    
    if (!SUPPORTED_SERVERS.has(server)) {
        redirectToVersionPage(server);
        return;
    }

    API_BASE = server === 'v2' ? '/api/v2' : '/api';
    
    applyServerClass(server);
    updateMobileFilterVisibility();
    loadAllAnimePage();
}

async function fetchAllAnimeV1() {
    try {
        const response = await fetch(`${API_BASE}/all-anime`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching all anime V1:', error);
        return null;
    }
}

async function fetchAllAnimeV2(filters = {}, page = 1) {
    try {
        const params = new URLSearchParams();
        if (page > 1) params.append('page', page);
        if (filters.title) params.append('title', filters.title);
        if (filters.status) params.append('status', filters.status);
        if (filters.type) params.append('type', filters.type);
        if (filters.order) params.append('order', filters.order);
        if (filters.genre && Array.isArray(filters.genre)) {
            filters.genre.forEach(g => params.append('genre', g));
        }
        
        const queryString = params.toString();
        const url = queryString ? `${API_BASE}/all-anime?${queryString}` : `${API_BASE}/all-anime`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching all anime V2:', error);
        return null;
    }
}

function createAlphabetNav(animeData) {
    const alphabetNav = document.getElementById('alphabetNav');
    if (!alphabetNav) return;

    alphabetNav.replaceChildren();

    if (!animeData || animeData.length === 0) {
        return;
    }

    const navContainer = document.createElement('div');
    navContainer.className = 'alphabet-nav-container';

    animeData.forEach((group) => {
        const link = document.createElement('a');
        link.href = `#section-${group.letter}`;
        link.className = 'alphabet-btn';
        link.textContent = group.letter;
        navContainer.appendChild(link);
    });

    alphabetNav.appendChild(navContainer);
}

function createV1AnimeListItem(anime) {
    const item = document.createElement('div');
    item.className = 'anime-list-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');

    const openDetail = () => goToDetail(anime.slug, 'v1');
    item.addEventListener('click', openDetail);
    item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
        }
    });

    const title = document.createElement('span');
    title.className = 'anime-list-title';
    title.textContent = anime.title || 'Tanpa judul';

    const arrow = document.createElement('span');
    arrow.className = 'anime-list-arrow';
    arrow.textContent = '→';

    item.appendChild(title);
    item.appendChild(arrow);
    return item;
}

function displayAllAnimeV1(animeData) {
    const container = document.getElementById('allAnimeContainer');
    container.replaceChildren();

    if (!animeData || animeData.length === 0) {
        showListError(container, 'Tidak ada data anime');
        return;
    }

    animeData.forEach((group) => {
        const section = document.createElement('div');
        section.className = 'anime-letter-section';
        section.id = `section-${group.letter}`;

        const header = document.createElement('h2');
        header.className = 'letter-header';
        header.textContent = group.letter;

        const grid = document.createElement('div');
        grid.className = 'anime-list-grid';

        if (group.anime && group.anime.length > 0) {
            group.anime.forEach((anime) => {
                grid.appendChild(createV1AnimeListItem(anime));
            });
        } else {
            const empty = document.createElement('p');
            empty.className = 'no-anime';
            empty.textContent = 'Tidak ada anime';
            grid.appendChild(empty);
        }

        section.appendChild(header);
        section.appendChild(grid);
        container.appendChild(section);
    });
}

function createAllAnimeV2Card(anime) {
    const card = document.createElement('div');
    card.className = 'anime-card anime-list-item';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const openDetail = () => goToDetail(anime.slug, 'v2');
    card.addEventListener('click', openDetail);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
        }
    });

    const thumb = document.createElement('div');
    thumb.className = 'anime-thumb';
    thumb.appendChild(createPosterImage(anime));

    const overlay = document.createElement('div');
    overlay.className = 'anime-overlay';

    const type = document.createElement('div');
    type.className = 'anime-type';
    type.textContent = anime.type || 'N/A';
    overlay.appendChild(type);

    if (anime.rating) {
        const rating = document.createElement('div');
        rating.className = 'anime-rating';
        rating.textContent = `⭐ ${anime.rating}`;
        overlay.appendChild(rating);
    }

    thumb.appendChild(overlay);

    const info = document.createElement('div');
    info.className = 'anime-info';

    const title = document.createElement('div');
    title.className = 'anime-title';
    title.textContent = anime.title || 'Tanpa judul';
    title.title = anime.title || '';

    const meta = document.createElement('div');
    meta.className = 'anime-meta';
    meta.textContent = anime.status || 'Unknown';

    info.appendChild(title);
    info.appendChild(meta);

    if (anime.genres && anime.genres.length > 0) {
        const genresWrap = document.createElement('div');
        genresWrap.className = 'anime-genres';
        anime.genres.slice(0, 3).forEach((genre) => {
            const tag = document.createElement('span');
            tag.className = 'genre-tag';
            tag.textContent = genre.name || '';
            genresWrap.appendChild(tag);
        });
        info.appendChild(genresWrap);
    }

    card.appendChild(thumb);
    card.appendChild(info);
    return card;
}

function displayAllAnimeV2(animeData) {
    const container = document.getElementById('allAnimeContainer');
    container.replaceChildren();

    if (!animeData || animeData.length === 0) {
        showListError(container, 'Tidak ada data anime');
        return;
    }

    const list = document.createElement('div');
    list.className = 'anime-list';
    animeData.forEach((anime) => {
        list.appendChild(createAllAnimeV2Card(anime));
    });
    container.appendChild(list);
}

function goToDetail(slug, version) {
    if (slug) {
        const detailPage = version === 'v2' ? `/detail-v2/${slug}` : `/detail/${slug}`;
        window.location.href = detailPage;
    }
}

async function loadAllAnimePage(page = 1) {
    if (!SUPPORTED_SERVERS.has(currentServer)) {
        return;
    }

    currentPage = page;
    
    const container = document.getElementById('allAnimeContainer');
    showListLoading(container, 'Memuat daftar anime...');
    
    // Update page title and description
    const pageTitle = document.getElementById('pageTitle');
    const pageDescription = document.getElementById('pageDescription');
    const filters = document.getElementById('animeFilters');
    const mobileToggle = document.getElementById('mobileFilterToggle');
    
    if (currentServer === 'v2') {
        pageTitle.textContent = 'Daftar Anime (Samehadaku)';
        pageDescription.textContent = 'Semua anime dengan filter';
        
        // Show filters for V2
        if (filters) {
            filters.classList.remove('hidden');
            filters.classList.remove('mobile-open');
        }
        if (mobileToggle) {
            mobileToggle.classList.remove('active');
            mobileToggle.setAttribute('aria-expanded', 'false');
        }
        const alphabetNav = document.getElementById('alphabetNav');
        if (alphabetNav) {
            alphabetNav.replaceChildren();
        }
        updateMobileFilterVisibility();
        
        // Get current filters including genres
        const selectedGenres = getSelectedGenres();
        const currentFilters = {
            title: document.getElementById('filterTitle')?.value || '',
            status: document.getElementById('filterStatus')?.value || '',
            type: document.getElementById('filterType')?.value || '',
            order: document.getElementById('filterOrder')?.value || 'title',
            genre: selectedGenres
        };
        
        const data = await fetchAllAnimeV2(currentFilters, page);
        
        if (data && data.data && data.data.animeData) {
            displayAllAnimeV2(data.data.animeData);
            
            // Handle pagination
            if (data.data.pagination) {
                paginationData = data.data.pagination;
                updatePaginationControls();
            }
        } else {
            showListError(container, 'Gagal memuat daftar anime', () => loadAllAnimePage(page));
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        pageTitle.textContent = 'Daftar Lengkap Anime (Otakudesu)';
        pageDescription.textContent = 'Semua anime A-Z';
        
        // Hide filters for V1
        if (filters) {
            filters.classList.add('hidden');
            filters.classList.remove('mobile-open');
        }
        if (mobileToggle) {
            mobileToggle.classList.remove('active');
            mobileToggle.setAttribute('aria-expanded', 'false');
        }
        updateMobileFilterVisibility();
        
        const data = await fetchAllAnimeV1();
        
        if (data && data.data) {
            createAlphabetNav(data.data);
            displayAllAnimeV1(data.data);
        } else {
            container.innerHTML = '<div class="error">Gagal memuat daftar anime</div>';
            
            const alphabetNav = document.getElementById('alphabetNav');
            if (alphabetNav) alphabetNav.replaceChildren();
        }
    }

    updateMobileFilterVisibility();
}

// Pagination functions
function updatePaginationControls() {
    const paginationContainer = document.getElementById('paginationContainer');
    const paginationInfo = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (!paginationData || currentServer !== 'v2') {
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }
    
    // Show pagination
    if (paginationContainer) paginationContainer.style.display = 'block';
    
    // Update info text
    if (paginationInfo) {
        paginationInfo.textContent = `Page ${paginationData.current_page} of ${paginationData.total_pages}`;
    }
    
    // Update button states
    if (prevBtn) {
        prevBtn.disabled = !paginationData.has_previous_page;
        prevBtn.style.opacity = paginationData.has_previous_page ? '1' : '0.5';
        prevBtn.style.cursor = paginationData.has_previous_page ? 'pointer' : 'not-allowed';
    }
    
    if (nextBtn) {
        nextBtn.disabled = !paginationData.has_next_page;
        nextBtn.style.opacity = paginationData.has_next_page ? '1' : '0.5';
        nextBtn.style.cursor = paginationData.has_next_page ? 'pointer' : 'not-allowed';
    }
}

function goToNextPage() {
    if (paginationData && paginationData.has_next_page) {
        loadAllAnimePage(paginationData.next_page);
    }
}

function goToPreviousPage() {
    if (paginationData && paginationData.has_previous_page) {
        loadAllAnimePage(paginationData.previous_page);
    }
}

// Filter functions for V2
function applyFilters() {
    if (currentServer === 'v2') {
        currentPage = 1; // Reset to first page when applying filters
        loadAllAnimePage(1);
    }
}

function resetFilters() {
    if (currentServer === 'v2') {
        document.getElementById('filterTitle').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterType').value = '';
        document.getElementById('filterOrder').value = 'title';
        
        // Uncheck all genre checkboxes
        const genreCheckboxes = document.querySelectorAll('input[name="genre"]');
        genreCheckboxes.forEach(cb => cb.checked = false);
        
        // Update genre button text
        updateGenreButtonText();
        
        currentPage = 1;
        loadAllAnimePage(1);
    }
}

// Genre filter functions
function toggleGenrePanel() {
    const panel = document.getElementById('genrePanel');
    const btn = document.getElementById('genreToggleBtn');
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        btn.innerHTML = 'Pilih Genre ▲';
    } else {
        panel.style.display = 'none';
        btn.innerHTML = 'Pilih Genre ▼';
    }
}

function getSelectedGenres() {
    const checkboxes = document.querySelectorAll('input[name="genre"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function updateGenreButtonText() {
    const selected = getSelectedGenres();
    const btn = document.getElementById('genreToggleBtn');
    
    if (selected.length === 0) {
        btn.innerHTML = 'Pilih Genre ▼';
    } else {
        const isOpen = document.getElementById('genrePanel').style.display === 'block';
        const arrow = isOpen ? '▲' : '▼';
        btn.innerHTML = `Genre (${selected.length} dipilih) ${arrow}`;
    }
}

// Add event listener to genre checkboxes to update button text
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    
    // Add listeners to genre checkboxes
    setTimeout(() => {
        const genreCheckboxes = document.querySelectorAll('input[name="genre"]');
        genreCheckboxes.forEach(cb => {
            cb.addEventListener('change', updateGenreButtonText);
        });
    }, 100);
});

// Smooth scroll to section (for V1)
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('alphabet-btn')) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            const offset = 100;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }
});
