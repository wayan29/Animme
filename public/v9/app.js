// V9 Auratail Configuration
const API_BASE = '/api/v9/auratail';
let homeData = null;
let currentCarouselIndex = 0;
let carouselInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = 'v9';
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
        v7: '/v7/home',
        v8: '/v8/home',
        v9: '/v9/home'
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
    console.log('[V9] Loading homepage...');
    const data = await fetchAPI('/home');
    console.log('[V9] Data received:', data);

    if (!data || !data.data) {
        console.error('[V9] No data received from API');
        showError('carouselContainer');
        showError('latestEpisodes');
        showError('popularToday');
        showError('ongoingSeries');
        showError('trendingAnime');
        showError('recommendations');
        return;
    }

    homeData = data.data;

    // Render carousel from featured_anime
    if (homeData.featured_anime && homeData.featured_anime.length > 0) {
        console.log('[V9] Rendering carousel with', homeData.featured_anime.length, 'featured anime');
        console.log('[V9] First featured poster:', homeData.featured_anime[0].poster);
        renderCarousel(homeData.featured_anime.slice(0, 6));
    }

    // Render latest episodes
    if (homeData.latest_episodes && homeData.latest_episodes.length > 0) {
        renderAnimeRow('latestEpisodes', homeData.latest_episodes, 'latestCount');
    }

    // Render popular today
    if (homeData.popular_today && homeData.popular_today.length > 0) {
        renderAnimeRow('popularToday', homeData.popular_today, 'popularCount');
    }

    // Render ongoing series
    if (homeData.ongoing_series && homeData.ongoing_series.length > 0) {
        renderAnimeRow('ongoingSeries', homeData.ongoing_series, 'ongoingCount');
    }

    // Render trending anime
    if (homeData.trending_anime && homeData.trending_anime.length > 0) {
        renderAnimeRow('trendingAnime', homeData.trending_anime, 'trendingCount');
    }

    // Render recommendations
    if (homeData.recommendations && homeData.recommendations.length > 0) {
        renderAnimeRow('recommendations', homeData.recommendations, 'recommendationsCount');
    }
}

function renderCarousel(animeList) {
    const container = document.getElementById('carouselContainer');
    if (!container) return;

    console.log('[V9] renderCarousel called with', animeList.length, 'items');
    console.log('[V9] First anime poster:', animeList[0].poster);

    container.innerHTML = animeList.map((anime, index) => {
        // Create internal V9 detail URL
        const detailUrl = anime.anime_id && anime.slug 
            ? `/v9/detail?animeId=${anime.anime_id}&slug=${anime.slug}`
            : anime.url || '#';
            
        return `
        <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-index="${index}" onclick="goToDetail('${anime.anime_id || ''}', '${anime.slug || ''}')">
            <div class="carousel-image" style="background-image: url('${anime.poster || '/placeholder.svg'}');"></div>
            <div class="carousel-content">
                <h2 class="carousel-title">${anime.title}</h2>
                <div class="carousel-meta">
                    ${anime.episode ? `<span class="carousel-badge">Episode ${anime.episode}</span>` : ''}
                    ${anime.type ? `<span class="carousel-type">${anime.type}</span>` : ''}
                </div>
                ${anime.description ? `<p class="carousel-description">${anime.description.substring(0, 150)}...</p>` : ''}
                <div class="carousel-btn-watch" onclick="event.stopPropagation(); goToDetail('${anime.anime_id || ''}', '${anime.slug || ''}')">
                    ▶ Lihat Detail
                </div>
            </div>
        </div>
        `;
    }).join('');

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

    container.innerHTML = animeList.map(anime => {
        // Determine the correct detail URL - prioritize internal V9 first
        let detailUrl = '#';
        if (anime.slug && anime.anime_id) {
            // Internal V9 detail with ID and slug (preferred)
            detailUrl = `/v9/detail?animeId=${anime.anime_id}&slug=${anime.slug}`;
        } else if (anime.slug) {
            // Internal V9 detail with slug only
            detailUrl = `/v9/detail?slug=${anime.slug}`;
        } else if (anime.url && !anime.url.includes('auratail.vip')) {
            // Only use external URL if not from auratail
            detailUrl = anime.url;
        }

        return `
            <div class="anime-card" onclick="window.open('${detailUrl}', '_blank')">
                <div class="anime-poster">
                    <img src="${anime.poster || '/placeholder.svg'}"
                         alt="${anime.title}"
                         onerror="this.src='/placeholder.svg'">
                    ${anime.episode ? `<div class="anime-badge">${anime.episode}</div>` : ''}
                    ${anime.type ? `<div class="anime-type">${anime.type}</div>` : ''}
                </div>
                <div class="anime-info">
                    <h4 class="anime-title">${anime.title}</h4>
                    <div class="anime-meta">
                        ${anime.episode ? `<span class="anime-episode">${anime.episode}</span>` : ''}
                        ${anime.type ? `<span class="anime-type-badge">${anime.type}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
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
        window.location.href = `/v9/search?q=${encodeURIComponent(query)}`;
    }
}

function goToDetail(animeId, slug) {
    if (animeId && slug) {
        window.location.href = `/v9/detail?animeId=${animeId}&slug=${slug}`;
    } else {
        console.warn('[V9] Missing animeId or slug for detail navigation');
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
