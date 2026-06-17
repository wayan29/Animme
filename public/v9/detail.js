// V9 Detail Page JavaScript
const API_BASE = '/api/v9/auratail';
let animeData = null;

// Get URL parameters
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        animeId: urlParams.get('animeId'),
        slug: urlParams.get('slug')
    };
}

// Platform detection
const isDesktop = window.innerWidth >= 769;
const isMobile = window.innerWidth <= 768;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = 'v9';
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }

    loadAnimeDetail();
    initPlatformSpecificFeatures();
    initSidebarToggle();
});

function initPlatformSpecificFeatures() {
    if (isDesktop) {
        initDesktopFeatures();
    } else {
        initMobileFeatures();
    }
}

function initDesktopFeatures() {
    console.log('[V9] Initializing desktop features');
    
    // Desktop-specific features
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('desktop-sidebar');
    }
    
    // Enhanced hover effects for desktop
    initDesktopHoverEffects();
    
    // Keyboard navigation for desktop
    initDesktopKeyboardNavigation();
}

function initMobileFeatures() {
    console.log('[V9] Initializing mobile features');
    
    // Mobile-specific features
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('mobile-sidebar');
    }
    
    // Touch optimizations
    initMobileTouchOptimizations();
    
    // Swipe gestures for mobile
    initMobileGestures();
}

function initDesktopHoverEffects() {
    // Enhanced hover effects untuk desktop
    const cards = document.querySelectorAll('.recommendation-card, .episode-btn, .info-item');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) scale(1)';
        });
    });
}

function initDesktopKeyboardNavigation() {
    // Keyboard navigation for accessibility
    document.addEventListener('keydown', (e) => {
        // ESC key to close sidebar on mobile
        if (e.key === 'Escape') {
            closeSidebar();
        }
        
        // Arrow keys for episode navigation
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const focusedEpisode = document.activeElement;
            if (focusedEpisode && focusedEpisode.classList.contains('episode-btn')) {
                e.preventDefault();
                navigateEpisodes(e.key === 'ArrowLeft' ? -1 : 1);
            }
        }
    });
}

function initMobileTouchOptimizations() {
    // Touch-specific optimizations
    const touchElements = document.querySelectorAll('.episode-btn, .recommendation-card, .nav-link');
    
    touchElements.forEach(element => {
        // Remove default hover states on mobile
        element.addEventListener('touchstart', () => {
            element.classList.add('touch-active');
        });
        
        element.addEventListener('touchend', () => {
            setTimeout(() => {
                element.classList.remove('touch-active');
            }, 150);
        });
    });
    
    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}

function initMobileGestures() {
    // Swipe gestures for mobile navigation
    let startX = 0;
    let startY = 0;
    const minSwipeDistance = 50;
    
    document.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', (e) => {
        if (!startX || !startY) return;
        
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        
        const diffX = startX - endX;
        const diffY = startY - endY;
        
        // Horizontal swipe untuk episode navigation
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
            if (diffX > 0) {
                // Swipe left - next episode
                navigateEpisodes(1);
            } else {
                // Swipe right - previous episode
                navigateEpisodes(-1);
            }
        }
        
        startX = 0;
        startY = 0;
    });
}

function navigateEpisodes(direction) {
    const episodes = document.querySelectorAll('.episode-btn');
    const focusedIndex = Array.from(episodes).findIndex(ep => ep === document.activeElement);
    
    if (focusedIndex !== -1) {
        const newIndex = focusedIndex + direction;
        if (newIndex >= 0 && newIndex < episodes.length) {
            episodes[newIndex].focus();
        }
    }
}

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
        throw error;
    }
}

async function loadAnimeDetail() {
    const params = getUrlParams();
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const animeDetail = document.getElementById('animeDetail');

    console.log('[V9] Loading anime detail:', params);

    if (!params.animeId || !params.slug) {
        showError('Parameter anime tidak lengkap');
        return;
    }

    try {
        showLoading();
        
        const data = await fetchAPI(`/anime/${params.animeId}/${params.slug}`);
        console.log('[V9] Detail data received:', data);

        if (!data || !data.data) {
            throw new Error('Data tidak valid');
        }

        animeData = data.data;
        renderAnimeDetail(animeData);
        
        showDetail();
    } catch (error) {
        console.error('[V9] Error loading detail:', error);
        showError('Gagal memuat detail anime: ' + error.message);
    }
}

function renderAnimeDetail(data) {
    // Update document title
    document.title = `${data.title} - AnimMe V9`;
    
    // Update breadcrumb
    document.getElementById('breadcrumbAnime').textContent = data.title;
    document.getElementById('breadcrumbAnime').href = `/v9/detail?animeId=${data.anime_id}&slug=${data.slug}`;

    // Poster
    const posterElement = document.getElementById('animePoster');
    if (posterElement) {
        posterElement.src = data.poster || '/placeholder.svg';
        posterElement.alt = data.title;
    }

    // Title
    const titleElement = document.getElementById('animeTitle');
    if (titleElement) {
        titleElement.textContent = data.title;
    }

    // Genres
    const genresContainer = document.getElementById('animeGenres');
    if (genresContainer) {
        if (data.genres && data.genres.length > 0) {
            genresContainer.innerHTML = data.genres.map(genre => 
                `<span class="genre-tag">${genre}</span>`
            ).join('');
        } else {
            genresContainer.innerHTML = '<span class="genre-tag">No Genre</span>';
        }
    }

    // Synopsis
    const synopsisElement = document.getElementById('animeSynopsis');
    if (synopsisElement) {
        synopsisElement.textContent = data.synopsis || 'Synopsis tidak tersedia';
    }

    // Info section
    renderAnimeInfo(data.info || {});
    
    // Episodes
    renderEpisodes(data.episodes || []);

    // Related anime
    if (data.anime_lainnya && data.anime_lainnya.length > 0) {
        renderRelatedAnime(data.anime_lainnya);
    }

    // Add click handler for episode cards
    addEpisodeHandlers();
}

function renderAnimeInfo(info) {
    const infoContainer = document.getElementById('animeInfo');
    if (!infoContainer) return;

    // Filter and format info items
    const validInfo = {};
    for (const [key, value] of Object.entries(info)) {
        if (value && value.toString().trim() !== '' && value !== '?' && 
            !value.toLowerCase().includes('sunrise') && 
            !value.toLowerCase().includes('/')) {
            
            // Format label
            const label = key.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            
            // Clean value (remove extra whitespace)
            const cleanValue = value.toString().replace(/\s+/g, ' ').trim();
            
            validInfo[label] = cleanValue;
        }
    }

    if (Object.keys(validInfo).length > 0) {
        infoContainer.innerHTML = Object.entries(validInfo).map(([key, value]) => `
            <div class="info-item">
                <span class="info-label">${key}:</span>
                <span class="info-value">${value}</span>
            </div>
        `).join('');
    } else {
        infoContainer.innerHTML = '<div class="info-item"><span class="info-label">Info:</span><span class="info-value">Tidak ada informasi tersedia</span></div>';
    }
}

function renderEpisodes(episodes) {
    const episodesList = document.getElementById('episodesList');
    
    if (!episodesList) return;
    
    if (episodes.length === 0) {
        episodesList.innerHTML = '<div class="no-episodes">Belum ada episode</div>';
        return;
    }

    // Get animeId and slug from URL params (since API doesn't return them)
    const params = getUrlParams();
    const animeId = params.animeId;
    const slug = params.slug;

    episodesList.innerHTML = episodes.map(episode => {
        // Extract episode number from title or URL
        const episodeMatch = episode.title.match(/Episode\s+(\d+)/i) || (episode.url && episode.url.match(/episode-(\d+)/));
        const episodeNum = episodeMatch ? episodeMatch[1] : '1';
        
        return `
            <a href="/v9/episode?animeId=${animeId}&slug=${slug}&episode=${episodeNum}" 
               class="episode-btn" 
               title="${episode.title}">
                ${episode.title}
            </a>
        `;
    }).join('');
}

function renderRelatedAnime(relatedAnime) {
    const relatedSection = document.getElementById('relatedSection');
    const relatedGrid = document.getElementById('relatedGrid');

    if (!relatedGrid || !relatedSection) return;

    relatedGrid.innerHTML = relatedAnime.map(anime => `
        <a href="/v9/detail?animeId=${anime.anime_id}&slug=${anime.slug}" class="recommendation-card">
            <img src="${anime.poster || '/placeholder.svg'}" alt="${anime.title}" class="recommendation-poster" onerror="this.src='/placeholder.svg'">
            <div class="recommendation-info">
                <div class="recommendation-title">${anime.title}</div>
                <div class="recommendation-meta">
                    ${anime.rating ? `⭐ ${anime.rating}` : 'Recommended'}
                </div>
            </div>
        </a>
    `).join('');

    relatedSection.style.display = 'block';
}

function playEpisode(episodeUrl) {
    if (!episodeUrl || episodeUrl === '#') {
        showError('URL episode tidak tersedia');
        return;
    }
    
    // Extract episode number from URL if possible
    const episodeMatch = episodeUrl.match(/episode-(\d+)/);
    const episodeNum = episodeMatch ? episodeMatch[1] : '';
    
    if (episodeNum) {
        const params = getUrlParams();
        window.location.href = `/v9/episode?animeId=${params.animeId}&slug=${params.slug}&episode=${episodeNum}`;
    } else {
        window.open(episodeUrl, '_blank');
    }
}

function goToDetail(animeId, slug) {
    window.location.href = `/v9/detail?animeId=${animeId}&slug=${slug}`;
}

function addEpisodeHandlers() {
    // Add hover effects and click handlers
    document.querySelectorAll('.episode-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 4px 12px rgba(229, 9, 20, 0.4)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = 'none';
        });
    });
}

function showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('animeDetail').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
}

function showDetail() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('animeDetail').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
}

function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('animeDetail').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    const openSidebar = () => {
        sidebar.classList.add('open');
        if (sidebarBackdrop) {
            sidebarBackdrop.classList.add('show');
        }
        
        // Animate hamburger menu on mobile
        if (menuToggle && isMobile) {
            menuToggle.classList.add('active');
        }
    };
    
    const closeSidebar = () => {
        sidebar.classList.remove('open');
        if (sidebarBackdrop) {
            sidebarBackdrop.classList.remove('show');
        }
        
        // Reset hamburger menu on mobile
        if (menuToggle && isMobile) {
            menuToggle.classList.remove('active');
        }
    };

    // Desktop sidebar (always visible, no toggle needed)
    if (isDesktop) {
        console.log('[V9] Desktop sidebar always visible');
        if (sidebar) {
            sidebar.style.left = '0';
        }
        return;
    }

    // Mobile sidebar (toggle required)
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (sidebar.classList.contains('open')) {
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

    // Close sidebar on window resize to desktop
    window.addEventListener('resize', () => {
        const currentIsDesktop = window.innerWidth >= 769;
        
        if (currentIsDesktop && !isDesktop) {
            // Switched to desktop
            closeSidebar();
            if (sidebar) {
                sidebar.style.left = '0';
            }
        } else if (!currentIsDesktop && isDesktop) {
            // Switched to mobile
            if (sidebar) {
                sidebar.style.left = '-100%';
            }
        }
    });
}
