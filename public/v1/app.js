// Server configuration
let currentServer = localStorage.getItem('selectedServer') || 'v1';

const pathname = window.location.pathname;
if (pathname.startsWith('/v6')) {
    currentServer = 'v6';
} else if (pathname.startsWith('/v5')) {
    currentServer = 'v5';
} else if (pathname.startsWith('/v4')) {
    currentServer = 'v4';
} else if (pathname.startsWith('/v3')) {
    currentServer = 'v3';
} else if (pathname.startsWith('/v2')) {
    currentServer = 'v2';
} else if (pathname.startsWith('/v1')) {
    currentServer = 'v1';
}

localStorage.setItem('selectedServer', currentServer);

const SERVER_API_MAP = {
    v1: '/api',
    v2: '/api/v2',
    v3: '/api/v3/kuramanime',
    v4: '/api/v4/anichin',
    v5: '/api/v5/anoboy',
    v6: '/api/v6/animeindo',
    v7: '/api/v7/nekopoi'
};

const EXTERNAL_HOME_SERVERS = {
    v8: '/v8/home',
    v9: '/v9/home',
    v10: '/v10/home'
};

const ID_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

let API_BASE = SERVER_API_MAP[currentServer] || '/api';

let homeData = null;
let featuredAnime = null;

const PLACEHOLDER_POSTER = 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image';

function getHomePath(server) {
    if (EXTERNAL_HOME_SERVERS[server]) return EXTERNAL_HOME_SERVERS[server];
    if (server === 'v7') return '/v7/home';
    if (server === 'v6') return '/v6/home';
    if (server === 'v5') return '/v5/home';
    if (server === 'v4') return '/v4/home';
    if (server === 'v3') return '/v3/home';
    if (server === 'v2') return '/v2/home';
    return '/v1/home';
}

function buildSkeletonCards(count = 5) {
    return Array.from({ length: count }, () => `
        <div class="anime-card skeleton-card" aria-hidden="true">
            <div class="skeleton-thumb"></div>
            <div class="skeleton-info">
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
            </div>
        </div>
    `).join('');
}

function showSkeletonLoading() {
    ['ongoingAnime', 'completedAnime', 'projectMovie'].forEach((containerId) => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = buildSkeletonCards(5);
        }
    });

    const heroTitle = document.getElementById('heroTitle');
    const heroDescription = document.getElementById('heroDescription');
    if (heroTitle) {
        heroTitle.textContent = '';
        heroTitle.classList.add('hero-skeleton');
    }
    if (heroDescription) {
        heroDescription.textContent = '';
        heroDescription.classList.add('hero-skeleton');
    }
}

function clearHeroSkeleton() {
    document.getElementById('heroTitle')?.classList.remove('hero-skeleton');
    document.getElementById('heroDescription')?.classList.remove('hero-skeleton');
}

function updateSectionLinks(isV2) {
    const ongoingViewAll = document.getElementById('ongoingViewAll');
    const completedViewAll = document.getElementById('completedViewAll');
    const footerSource = document.querySelector('.footer p:first-child');

    if (footerSource) {
        footerSource.innerHTML = isV2
            ? '<strong>AnimMe</strong> — Sumber: Samehadaku'
            : '<strong>AnimMe</strong> — Sumber: Otakudesu';
    }

    if (ongoingViewAll) {
        ongoingViewAll.href = isV2 ? '/anime-terbaru' : '/ongoing';
        ongoingViewAll.style.display = isV2 ? 'none' : '';
    }
    if (completedViewAll) {
        completedViewAll.href = isV2 ? '/anime-terbaru' : '/completed';
        completedViewAll.style.display = '';
    }
}

// Initialize server selector on page load
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = currentServer;
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }

    applyServerClass(currentServer);
    initSidebarToggle();
    initMobileSearch();
    showSkeletonLoading();
    loadHomePage();

    document.querySelectorAll('[data-home-nav]').forEach((element) => {
        element.addEventListener('click', () => {
            const targetPath = getHomePath(currentServer);
            if (window.location.pathname !== targetPath) {
                window.location.href = targetPath;
            } else {
                document.body.classList.remove('sidebar-open');
            }
        });
    });
});

function applyServerClass(server) {
    // Remove all server classes
    document.body.classList.remove('server-v1', 'server-v2', 'server-v3', 'server-v4', 'server-v5', 'server-v6', 'server-v7');

    // Add current server class
    const allowedServers = new Set(['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7']);
    const targetClass = allowedServers.has(server) ? `server-${server}` : 'server-v1';
    document.body.classList.add(targetClass);
}

function changeServer(server) {
    currentServer = server;
    localStorage.setItem('selectedServer', server);

    if (EXTERNAL_HOME_SERVERS[server]) {
        window.location.href = EXTERNAL_HOME_SERVERS[server];
        return;
    }

    const targetPath = getHomePath(server);

    if (window.location.pathname !== targetPath) {
        window.location.href = targetPath;
        return;
    }

    API_BASE = SERVER_API_MAP[server] || '/api';
    applyServerClass(server);
    showServerNotification(server);
    loadHomePage();
}

function showServerNotification(server) {
    const SERVER_NAME_MAP = {
        v1: 'Otakudesu',
        v2: 'Samehadaku',
        v3: 'Kuramanime',
        v4: 'Anichin',
        v5: 'Anoboy',
        v6: 'AnimeIndo',
        v7: 'Nekopoi'
    };
    const serverName = SERVER_NAME_MAP[server] || 'Otakudesu';
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'server-notification';
    notification.textContent = `Server beralih ke ${serverName}`;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    const topbar = document.querySelector('.topbar');
    const shouldAdd = window.scrollY > 100;

    if (navbar) {
        navbar.classList.toggle('scrolled', shouldAdd);
    }

    if (topbar) {
        topbar.classList.toggle('scrolled', shouldAdd);
    }
});

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
    showSkeletonLoading();

    const data = await fetchAPI('/home');
    if (!data || !data.data) {
        clearHeroSkeleton();
        showError('ongoingAnime', loadHomePage);
        showError('completedAnime', loadHomePage);
        return;
    }

    homeData = data;

    // Check if using V1 (Otakudesu) or V2 (Samehadaku) format
    const isV2 = data.data.recent_anime !== undefined;
    updateSectionLinks(isV2);

    if (isV2) {
        // V2 format - Samehadaku (top10_weekly + project_movie + recent_anime)
        const top10 = data.data.top10_weekly || [];
        const projectMovie = data.data.project_movie || [];
        const recentAnime = data.data.recent_anime || [];
        
        // Update section titles for V2
        document.getElementById('ongoingTitle').textContent = '🔥 Top 10 Minggu Ini';
        document.getElementById('completedTitle').textContent = '🆕 Episode Terbaru';
        
        // Show Project Movie section for V2
        const projectMovieSection = document.getElementById('projectMovieSection');
        if (projectMovieSection) {
            projectMovieSection.style.display = 'block';
        }
        
        // Display featured anime from top 10 or recent
        if (top10.length > 0) {
            displayFeaturedAnime(top10[0]);
        } else if (recentAnime.length > 0) {
            displayFeaturedAnime(recentAnime[0]);
        }
        
        // Display Top 10 in first section
        if (top10.length > 0) {
            displayAnimeList('ongoingAnime', top10, 'top10');
        } else {
            showError('ongoingAnime', loadHomePage);
        }

        if (recentAnime.length > 0) {
            displayAnimeList('completedAnime', recentAnime.slice(0, 8), 'recent');
        } else {
            showError('completedAnime', loadHomePage);
        }

        if (projectMovie.length > 0) {
            displayAnimeList('projectMovie', projectMovie, 'movie');
        } else {
            showError('projectMovie', loadHomePage);
        }

        document.getElementById('schedulePreviewSection')?.style.setProperty('display', 'none');
    } else {
        // V1 format - Otakudesu (ongoing_anime & complete_anime)
        
        // Hide Project Movie section for V1
        const projectMovieSection = document.getElementById('projectMovieSection');
        if (projectMovieSection) {
            projectMovieSection.style.display = 'none';
        }
        
        // Update section titles for V1
        document.getElementById('ongoingTitle').textContent = 'Anime Ongoing';
        document.getElementById('completedTitle').textContent = 'Anime Tamat';
        
        // Display featured anime from ongoing
        if (data.data.ongoing_anime && data.data.ongoing_anime.length > 0) {
            displayFeaturedAnime(data.data.ongoing_anime[0]);
        }
        
        // Display ongoing anime list
        if (data.data.ongoing_anime && data.data.ongoing_anime.length > 0) {
            displayAnimeList('ongoingAnime', data.data.ongoing_anime, 'ongoing');
        } else {
            showError('ongoingAnime', loadHomePage);
        }

        if (data.data.complete_anime && data.data.complete_anime.length > 0) {
            displayAnimeList('completedAnime', data.data.complete_anime, 'completed');
        } else {
            showError('completedAnime', loadHomePage);
        }

        loadSchedulePreview();
    }
}

async function loadSchedulePreview() {
    const section = document.getElementById('schedulePreviewSection');
    const container = document.getElementById('schedulePreview');
    const title = document.getElementById('scheduleTitle');

    if (!section || !container || currentServer !== 'v1') {
        section?.style.setProperty('display', 'none');
        return;
    }

    section.style.display = '';
    container.replaceChildren();

    const todayName = ID_DAY_NAMES[new Date().getDay()];
    if (title) {
        title.textContent = `Jadwal Rilis ${todayName}`;
    }

    try {
        const response = await fetch('/api/schedule');
        if (!response.ok) {
            throw new Error('Schedule request failed');
        }

        const data = await response.json();
        const todayList = data?.data?.[todayName] || [];

        if (!todayList.length) {
            const empty = document.createElement('p');
            empty.className = 'schedule-empty';
            empty.textContent = 'Tidak ada jadwal rilis untuk hari ini.';
            container.appendChild(empty);
            return;
        }

        todayList.slice(0, 10).forEach((item) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'schedule-chip';
            chip.textContent = item.title || 'Anime';
            chip.addEventListener('click', () => goToDetail(item.slug));
            container.appendChild(chip);
        });
    } catch (error) {
        const empty = document.createElement('p');
        empty.className = 'schedule-empty';
        empty.textContent = 'Gagal memuat jadwal rilis.';
        container.appendChild(empty);
    }
}

function displayFeaturedAnime(anime) {
    const heroSection = document.getElementById('heroSection');
    const heroTitle = document.getElementById('heroTitle');
    const heroDescription = document.getElementById('heroDescription');
    const heroPlayBtn = document.getElementById('heroPlayBtn');
    const heroInfoBtn = document.getElementById('heroInfoBtn');

    featuredAnime = anime;
    clearHeroSkeleton();

    if (anime.poster) {
        heroSection.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${anime.poster})`;
    }

    heroTitle.textContent = anime.title || 'Anime Unggulan';

    let description = 'Tonton anime terbaru dan terpopuler di AnimMe';
    if (anime.synopsis) {
        description = anime.synopsis;
    } else {
        const parts = [];
        if (anime.current_episode) {
            parts.push(`Episode ${anime.current_episode}`);
        }
        if (anime.release_date) {
            parts.push(anime.release_date);
        }
        if (anime.release_day) {
            parts.push(`Rilis setiap ${anime.release_day}`);
        }
        if (parts.length > 0) {
            description = parts.join(' • ');
        }
    }
    heroDescription.textContent = description;

    heroPlayBtn.onclick = () => {
        if (currentServer === 'v1' && typeSupportsLatestEpisode(anime)) {
            playLatestEpisode(anime);
            return;
        }
        if (anime.slug) {
            goToDetail(anime.slug);
        }
    };

    heroInfoBtn.onclick = () => {
        if (anime.slug) {
            goToDetail(anime.slug);
        }
    };
}

function typeSupportsLatestEpisode(anime) {
    return Boolean(anime?.slug && anime?.current_episode);
}

function buildEpisodeInfo(anime, type) {
    const isV2Format = anime.release_date !== undefined && currentServer === 'v2';

    if (isV2Format) {
        if (type === 'top10') {
            const rating = anime.rating ? `⭐ ${anime.rating}` : 'No Rating';
            return anime.rank ? `#${anime.rank} • ${rating}` : rating;
        }
        if (type === 'movie' && anime.genres) {
            const releaseInfo = anime.release_date ? `🎬 ${anime.release_date}` : 'Movie';
            const genresInfo = anime.genres.length > 0 ? anime.genres.slice(0, 2).join(', ') : '';
            return genresInfo ? `${releaseInfo} • ${genresInfo}` : releaseInfo;
        }
        let info = `Ep ${anime.current_episode || 'N/A'}`;
        if (anime.release_date) {
            info += ` • ${anime.release_date}`;
        }
        return info;
    }

    if (type === 'ongoing') {
        let info = anime.current_episode ? `Episode ${anime.current_episode}` : 'Episode N/A';
        if (anime.release_date) {
            info += ` • ${anime.release_date}`;
        }
        if (anime.release_day) {
            info += ` • ${anime.release_day}`;
        }
        return info;
    }

    if (type === 'completed') {
        let info = `${anime.episode_count || 'N/A'} Episode`;
        if (anime.rating) {
            info += ` • ⭐ ${anime.rating}`;
        }
        return info;
    }

    return anime.current_episode || anime.episode_count || 'Episode N/A';
}

function createPosterImage(anime) {
    const image = document.createElement('img');
    image.src = anime.poster || PLACEHOLDER_POSTER;
    image.alt = anime.title || 'Anime poster';
    image.className = 'anime-poster';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
        image.src = PLACEHOLDER_POSTER;
    });
    return image;
}

function createAnimeCard(anime, type = 'ongoing') {
    const card = document.createElement('div');
    card.className = type === 'top10' ? 'anime-card top-ten-card' : 'anime-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const activateCard = () => handleAnimeCardClick(anime, type);
    card.addEventListener('click', activateCard);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activateCard();
        }
    });

    const thumb = document.createElement('div');
    thumb.className = 'anime-thumb';

    if (type === 'top10' && anime.rank) {
        const rankBadge = document.createElement('div');
        rankBadge.className = 'rank-badge';
        rankBadge.textContent = `#${anime.rank}`;
        thumb.appendChild(rankBadge);
    }

    if (type === 'top10' && anime.rating) {
        const ratingBadge = document.createElement('div');
        ratingBadge.className = 'rating-badge';
        ratingBadge.textContent = `⭐ ${anime.rating}`;
        thumb.appendChild(ratingBadge);
    }

    if (currentServer === 'v2' && type === 'recent') {
        const playBadge = document.createElement('div');
        playBadge.className = 'play-now-badge';
        playBadge.textContent = '▶ Episode Baru';
        thumb.appendChild(playBadge);
    }

    thumb.appendChild(createPosterImage(anime));

    const info = document.createElement('div');
    info.className = 'anime-info';

    const title = document.createElement('div');
    title.className = 'anime-title';
    title.textContent = anime.title || 'Tanpa judul';
    title.title = anime.title || '';

    const meta = document.createElement('div');
    meta.className = 'anime-meta';
    meta.textContent = buildEpisodeInfo(anime, type);

    info.appendChild(title);
    info.appendChild(meta);
    card.appendChild(thumb);
    card.appendChild(info);
    return card;
}

async function handleAnimeCardClick(anime, type) {
    if (currentServer === 'v1' && type === 'ongoing') {
        await playLatestEpisode(anime);
        return;
    }

    if (currentServer === 'v2' && type === 'recent') {
        goToEpisode(anime.slug);
        return;
    }

    goToDetail(anime.slug);
}

async function playLatestEpisode(anime) {
    if (!anime?.slug) {
        return;
    }

    if (anime.episode_slug && anime.episode_slug !== anime.slug) {
        goToEpisode(anime.episode_slug);
        return;
    }

    if (!anime.current_episode) {
        goToDetail(anime.slug);
        return;
    }

    try {
        const response = await fetch(
            `/api/latest-episode/${encodeURIComponent(anime.slug)}?ep=${encodeURIComponent(anime.current_episode)}`
        );
        if (response.ok) {
            const data = await response.json();
            if (data?.data?.episode_slug) {
                goToEpisode(data.data.episode_slug);
                return;
            }
        }
    } catch (error) {
        console.error('Failed to resolve latest episode:', error);
    }

    goToDetail(anime.slug);
}

function displayAnimeList(containerId, animeList, type = 'ongoing') {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.className = currentServer === 'v1' ? 'anime-row anime-row-scroll' : 'anime-row';
    container.replaceChildren();

    if (!animeList || animeList.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'error';
        empty.textContent = 'Tidak ada data anime';
        container.appendChild(empty);
        return;
    }

    animeList.forEach((anime) => {
        container.appendChild(createAnimeCard(anime, type));
    });
}

function goToDetail(slug) {
    if (slug) {
        const detailPath = currentServer === 'v2' ? '/detail-v2' : '/detail';
        window.location.href = `${detailPath}/${slug}`;
    }
}

function goToEpisode(slug) {
    if (slug) {
        const playerPath = currentServer === 'v2' ? '/player-v2' : '/v1/player';
        window.location.href = `${playerPath}/${slug}`;
    }
}

function showError(containerId, retryFn = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.className = 'error-state';

    const message = document.createElement('p');
    message.className = 'error';
    message.textContent = 'Gagal memuat data';
    wrapper.appendChild(message);

    if (typeof retryFn === 'function') {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'retry-btn';
        retryButton.textContent = 'Coba Lagi';
        retryButton.addEventListener('click', retryFn);
        wrapper.appendChild(retryButton);
    }

    container.appendChild(wrapper);
}

function showInlineMessage(message, type = 'info') {
    let banner = document.getElementById('inlineMessage');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'inlineMessage';
        banner.className = 'inline-message';
        document.querySelector('.topbar')?.insertAdjacentElement('afterend', banner);
    }

    banner.textContent = message;
    banner.className = `inline-message ${type} visible`;
    clearTimeout(showInlineMessage.hideTimer);
    showInlineMessage.hideTimer = setTimeout(() => {
        banner.classList.remove('visible');
    }, 3000);
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput?.value.trim();

    if (!keyword) {
        showInlineMessage('Masukkan kata kunci pencarian!', 'warning');
        return;
    }

    window.location.href = `/search/${encodeURIComponent(keyword)}`;
}

document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchAnime();
    }
});

// Mobile search toggle
function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('searchInput');
    
    if (searchIconBtn) {
        searchIconBtn.addEventListener('click', () => {
            searchContainer.classList.add('active');
            setTimeout(() => searchInput.focus(), 100);
        });
    }
    
    if (searchCloseBtn) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer.classList.remove('active');
            searchInput.value = '';
        });
    }
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchContainer.classList.contains('active')) {
            searchContainer.classList.remove('active');
        }
    });
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
        if (window.innerWidth > 1024) {
            closeSidebar();
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSidebar();
        }
    });
}


