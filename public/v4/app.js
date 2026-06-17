// V4 Anichin Configuration
const API_BASE = '/api/v4/anichin';
let homeData = null;
let currentCarouselIndex = 0;
let carouselInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = 'v4';
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }

    loadHomePage();
    initMobileSearch();
    initSidebarToggle();
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
        v7: '/v7/home'
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
    console.log('[V4] Loading homepage...');
    const data = await fetchAPI('/home');
    console.log('[V4] Data received:', data);

    if (!data || !data.data) {
        console.error('[V4] No data received from API');
        showError('carouselContainer');
        showError('popularToday');
        showError('latestReleases');
        return;
    }

    homeData = data.data;

    // Render carousel
    if (homeData.banner_recommendations && homeData.banner_recommendations.length > 0) {
        renderCarousel(homeData.banner_recommendations.slice(0, 6));
    } else if (homeData.popular_today && homeData.popular_today.length > 0) {
        renderCarousel(homeData.popular_today.slice(0, 6));
    }

    // Render popular today
    if (homeData.popular_today && homeData.popular_today.length > 0) {
        renderAnimeRow('popularToday', homeData.popular_today, 'popularCount');
    }

    // Render latest releases
    if (homeData.latest_releases && homeData.latest_releases.length > 0) {
        renderAnimeRow('latestReleases', homeData.latest_releases, 'latestCount');
    }
}

function renderCarousel(animeList) {
    const container = document.getElementById('carouselContainer');
    if (!container) return;

    container.innerHTML = animeList.map((anime, index) => `
        <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
            <div class="carousel-image" style="background-image: url('${anime.backdrop || anime.poster || '/placeholder.jpg'}');"></div>
            <div class="carousel-content">
                <h2 class="carousel-title">${anime.title}</h2>
                <div class="carousel-meta">
                    ${anime.episode ? `<span class="carousel-badge">Episode ${anime.episode}</span>` : ''}
                    ${anime.type ? `<span class="carousel-type">${anime.type}</span>` : ''}
                    ${anime.rating ? `<span class="carousel-rating">⭐ ${anime.rating}</span>` : ''}
                </div>
                ${anime.description ? `<p class="carousel-description">${anime.description.substring(0, 150)}...</p>` : ''}
                <a href="${anime.watch_url || `/v4/detail?animeId=${anime.id || anime.animeId}&slug=${anime.slug}`}" class="carousel-btn-watch">
                    ▶ Tonton Sekarang
                </a>
            </div>
        </div>
    `).join('');

    // Setup carousel indicators
    const indicators = document.getElementById('carouselIndicators');
    if (indicators) {
        indicators.innerHTML = animeList.map((_, index) =>
            `<button class="indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></button>`
        ).join('');

        // Add click handlers to indicators
        indicators.querySelectorAll('.indicator').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                goToSlide(index);
            });
        });
    }

    // Setup navigation buttons
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');

    if (prevBtn) prevBtn.addEventListener('click', () => changeSlide(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changeSlide(1));

    // Auto-play carousel
    startCarousel();
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');

    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });

    indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === index);
    });

    currentCarouselIndex = index;
}

function changeSlide(direction) {
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;

    currentCarouselIndex += direction;

    if (currentCarouselIndex >= slides.length) currentCarouselIndex = 0;
    if (currentCarouselIndex < 0) currentCarouselIndex = slides.length - 1;

    goToSlide(currentCarouselIndex);
}

function startCarousel() {
    if (carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(() => changeSlide(1), 5000);
}

function renderAnimeRow(containerId, animeList, countBadgeId) {
    const container = document.getElementById(containerId);
    const badge = document.getElementById(countBadgeId);

    if (!container) return;

    if (badge) {
        badge.textContent = animeList.length;
    }

    container.innerHTML = animeList.map(anime => `
        <div class="anime-card" onclick="window.location.href='/v4/detail?animeId=${anime.id || anime.animeId}&slug=${anime.slug}'">
            <div class="anime-poster">
                <img src="${anime.poster || '/placeholder.jpg'}"
                     alt="${anime.title}"
                     onerror="this.src='/placeholder.jpg'">
                ${anime.episode ? `<div class="anime-badge">${anime.episode}</div>` : ''}
                ${anime.type ? `<div class="anime-type">${anime.type}</div>` : ''}
            </div>
            <div class="anime-info">
                <h4 class="anime-title">${anime.title}</h4>
                <div class="anime-meta">
                    ${anime.rating ? `<span class="anime-rating">⭐ ${anime.rating}</span>` : ''}
                    ${anime.releaseDate ? `<span class="anime-date">${anime.releaseDate}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function showError(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div class="error-message">Gagal memuat data. Silakan coba lagi nanti.</div>';
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput?.value?.trim();

    if (query) {
        window.location.href = `/v4/search?q=${encodeURIComponent(query)}`;
    }
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('searchInput');

    if (searchIconBtn) {
        searchIconBtn.addEventListener('click', () => {
            searchContainer?.classList.add('active');
            searchInput?.focus();
        });
    }

    if (searchCloseBtn) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer?.classList.remove('active');
        });
    }

    // Handle Enter key
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
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const sidebarLinks = document.querySelectorAll('.sidebar-menu .nav-link');
    const body = document.body;

    const openSidebar = () => body.classList.add('sidebar-open');
    const closeSidebar = () => body.classList.remove('sidebar-open');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (body.classList.contains('sidebar-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', closeSidebar);
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeSidebar);
    }

    sidebarLinks.forEach((link) => link.addEventListener('click', closeSidebar));

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });
}
