// V10 Vidku Configuration
const API_BASE = '/api/v10/vidku';
let homeData = null;
let currentPage = 1;
let totalPages = 1;
let currentCarouselIndex = 0;
let carouselInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = 'v10';
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }

    loadHomePage();
    initMobileSearch();
    initSidebarToggle();
    initPagination();
});

function changeServer(server) {
    localStorage.setItem('selectedServer', server);

    const TARGET_PATHS = {
        v1: '/v1/home',
        v2: '/v2/home',
        v3: '/v3/home',
        v4: '/v4/home',
        v5: '/v5/home',
        v6: '/v6/home',
        v7: '/v7/home',
        v8: '/v8/home',
        v9: '/v9/home',
        v10: '/v10/'
    };

    window.location.href = TARGET_PATHS[server] || '/v1/home';
}

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

async function loadHomePage() {
    console.log('[V10] Loading homepage...');
    const data = await fetchAPI('/home');
    console.log('[V10] Data received:', data);

    if (!data || !data.data) {
        console.error('[V10] No data received from API');
        showError('trendingAnime');
        showError('airingAnime');
        showError('latestEpisodes');
        return;
    }

    homeData = data.data;

    if (homeData.featured && homeData.featured.length > 0) {
        displayCarousel(homeData.featured);
    } else if (homeData.trending && homeData.trending.length > 0) {
        displayCarousel(homeData.trending.slice(0, 5));
    }

    if (homeData.trending && homeData.trending.length > 0) {
        renderAnimeRow('recommendedAnime', buildRecommendations(homeData), 'recommendedCount');
    }

    // Render trending anime
    if (homeData.trending && homeData.trending.length > 0) {
        renderAnimeRow('trendingAnime', homeData.trending, 'trendingCount');
    }

    // Render airing anime
    if (homeData.airing && homeData.airing.length > 0) {
        renderAnimeRow('airingAnime', homeData.airing, 'airingCount');
    }

    // Render latest episodes
    if (homeData.latest_episodes && homeData.latest_episodes.length > 0) {
        renderAnimeRow('latestEpisodes', homeData.latest_episodes, 'latestCount');
    }

    // Load pagination info
    loadAnimeList(currentPage);
}

function buildRecommendations(data) {
    const merged = [...(data.trending || []), ...(data.airing || []), ...(data.latest_episodes || [])];
    const seen = new Set();
    return merged.filter((item) => {
        const key = item.slug || item.title;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 10);
}

function displayCarousel(items) {
    const container = document.getElementById('carouselContainer');
    const indicators = document.getElementById('carouselIndicators');
    if (!container || !indicators) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada banner rekomendasi</div>';
        return;
    }

    container.innerHTML = items.map((anime, index) => `
        <a href="/v10/detail?slug=${encodeURIComponent(anime.slug || '')}" class="v10-carousel-slide ${index === 0 ? 'active' : ''}">
            <div class="v10-carousel-poster-wrap">
                <img src="${anime.poster || '/placeholder.jpg'}" alt="${anime.title || 'Anime'}" class="v10-carousel-poster" loading="${index === 0 ? 'eager' : 'lazy'}">
            </div>
            <div class="v10-carousel-content">
                <span class="v10-carousel-kicker">${anime.label || 'Sorotan Utama Vidku'}</span>
                <h2 class="v10-carousel-title">${anime.title || 'Tanpa Judul'}</h2>
                <p class="v10-carousel-meta">${anime.description || [anime.type, anime.status, anime.episode_number ? `Ep ${anime.episode_number}` : ''].filter(Boolean).join(' • ') || 'Streaming anime pilihan Vidku'}</p>
                ${Array.isArray(anime.meta) && anime.meta.length ? `<div class="v10-carousel-badges">${anime.meta.slice(0, 4).map((item) => `<span class="v10-carousel-badge">${item}</span>`).join('')}</div>` : ''}
                <div class="v10-carousel-buttons">
                    <span class="v10-carousel-cta primary">▶ Buka Detail</span>
                    <span class="v10-carousel-cta">${Array.isArray(anime.qualities) && anime.qualities.length ? anime.qualities[0] : (anime.rating ? `⭐ ${anime.rating}` : 'Vidku Choice')}</span>
                </div>
            </div>
        </a>
    `).join('');

    indicators.innerHTML = items.map((_, index) =>
        `<button class="v10-indicator ${index === 0 ? 'active' : ''}" onclick="event.stopPropagation(); goToSlide(${index})"></button>`
    ).join('');

    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    if (prevBtn) {
        prevBtn.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            navigateCarousel(-1);
        };
    }
    if (nextBtn) {
        nextBtn.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            navigateCarousel(1);
        };
    }

    stopCarouselAutoPlay();
    startCarouselAutoPlay(items.length);
}

function navigateCarousel(direction) {
    const slides = document.querySelectorAll('.v10-carousel-slide');
    const indicators = document.querySelectorAll('.v10-indicator');
    if (!slides.length) return;

    slides[currentCarouselIndex].classList.remove('active');
    indicators[currentCarouselIndex]?.classList.remove('active');
    currentCarouselIndex = (currentCarouselIndex + direction + slides.length) % slides.length;
    slides[currentCarouselIndex].classList.add('active');
    indicators[currentCarouselIndex]?.classList.add('active');
    stopCarouselAutoPlay();
    startCarouselAutoPlay(slides.length);
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.v10-carousel-slide');
    const indicators = document.querySelectorAll('.v10-indicator');
    if (!slides.length) return;

    slides[currentCarouselIndex].classList.remove('active');
    indicators[currentCarouselIndex]?.classList.remove('active');
    currentCarouselIndex = index;
    slides[currentCarouselIndex].classList.add('active');
    indicators[currentCarouselIndex]?.classList.add('active');
    stopCarouselAutoPlay();
    startCarouselAutoPlay(slides.length);
}

function startCarouselAutoPlay(slideCount) {
    if (slideCount <= 1) return;
    carouselInterval = setInterval(() => navigateCarousel(1), 5000);
}

function stopCarouselAutoPlay() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
}

async function loadAnimeList(page) {
    console.log('[V10] Loading anime list page', page);
    const data = await fetchAPI(`/anime-list/${page}`);
    
    if (data && data.data && data.data.animeData) {
        renderAnimeRow('latestEpisodes', data.data.animeData, 'latestCount');
        
        if (data.data.paginationData) {
            currentPage = data.data.paginationData.current_page;
            totalPages = data.data.paginationData.last_page;
            updatePagination();
        }
    }
}

function renderAnimeRow(containerId, animeList, countId) {
    const container = document.getElementById(containerId);
    const countEl = document.getElementById(countId);
    
    if (!container) return;

    if (countEl) {
        countEl.textContent = animeList.length;
    }

    if (containerId === 'trendingAnime') {
        const heroEl = document.getElementById('heroTrendingCount');
        if (heroEl) heroEl.textContent = animeList.length;
    }

    if (containerId === 'airingAnime') {
        const heroEl = document.getElementById('heroAiringCount');
        if (heroEl) heroEl.textContent = animeList.length;
    }

    if (containerId === 'latestEpisodes') {
        const heroEl = document.getElementById('heroLatestCount');
        if (heroEl) heroEl.textContent = animeList.length;
    }

    const sectionClass = containerId === 'latestEpisodes' ? 'v10-card-latest' : 'v10-card-featured';

    container.innerHTML = animeList.map(anime => `
        <a class="anime-card v10-home-card ${sectionClass}" href="/v10/detail?slug=${anime.slug}">
            <div class="anime-poster">
                <img src="${anime.poster || '/placeholder.jpg'}" alt="${anime.title}" loading="lazy">
                <div class="anime-overlay">
                    <div class="anime-rating">${anime.rating || anime.status || 'Vidku'}</div>
                </div>
            </div>
            <div class="anime-info">
                <div class="v10-home-card-meta">
                    ${anime.type ? `<span class="anime-type">${anime.type}</span>` : '<span class="anime-type">Anime</span>'}
                    ${anime.status ? `<span class="anime-episode">${anime.status}</span>` : ''}
                </div>
                <h3 class="anime-title">${anime.title}</h3>
                <div class="v10-home-card-footer">
                    ${anime.episode_number ? `<span class="anime-episode">Episode ${anime.episode_number}</span>` : '<span class="anime-episode">Buka detail</span>'}
                    <span class="v10-home-card-link">Lihat →</span>
                </div>
            </div>
        </a>
    `).join('');

    if ((containerId === 'airingAnime' || containerId === 'latestEpisodes') && animeList.length > 0) {
        fillHomeRowGaps(containerId, animeList.length);
    }
}

function fillHomeRowGaps(containerId, count) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const targetCount = containerId === 'latestEpisodes' ? 20 : 10;
    if (count >= targetCount) return;

    const fillersNeeded = targetCount - count;
    const message = containerId === 'latestEpisodes' ? 'Episode berikutnya akan muncul di update selanjutnya...' : 'Memuat rekomendasi lain...';
    const footerLabel = containerId === 'latestEpisodes' ? 'Rilis berikutnya' : 'Update berikutnya';
    const fillers = Array.from({ length: fillersNeeded }, () => `
        <div class="v10-home-card v10-home-card-placeholder" aria-hidden="true">
            <div class="anime-poster"></div>
            <div class="anime-info">
                <div class="v10-home-card-meta">
                    <span class="anime-type">Vidku</span>
                    <span class="anime-episode">Soon</span>
                </div>
                <h3 class="anime-title">${message}</h3>
                <div class="v10-home-card-footer">
                    <span class="anime-episode">${footerLabel}</span>
                    <span class="v10-home-card-link">...</span>
                </div>
            </div>
        </div>
    `).join('');

    container.insertAdjacentHTML('beforeend', fillers);
}

function updatePagination() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const currentPageSpan = document.getElementById('currentPage');
    const paginationDiv = document.getElementById('pagination');

    if (!paginationDiv) return;

    paginationDiv.style.display = 'flex';

    if (currentPageSpan) {
        currentPageSpan.textContent = currentPage;
    }

    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
}

function initPagination() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadAnimeList(currentPage);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadAnimeList(currentPage);
            }
        });
    }
}

function showError(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div class="error">Gagal memuat data. Silakan coba lagi.</div>';
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput ? searchInput.value.trim() : '';
    
    if (keyword) {
        window.location.href = `/v10/search?q=${encodeURIComponent(keyword)}`;
    }
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchContainer = document.querySelector('.search-container');

    if (searchIconBtn && searchContainer) {
        searchIconBtn.addEventListener('click', () => {
            searchContainer.classList.add('active');
        });
    }

    if (searchCloseBtn && searchContainer) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer.classList.remove('active');
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAnime();
            }
        });
    }
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            if (backdrop) backdrop.classList.add('active');
        });
    }

    if (menuCloseBtn && sidebar) {
        menuCloseBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
        });
    }

    if (backdrop && sidebar) {
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('active');
            backdrop.classList.remove('active');
        });
    }
}
