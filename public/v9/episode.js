// V9 Episode Page JavaScript
const API_BASE = '/api/v9/auratail';
let episodeData = null;
let animeData = null;

// Get URL parameters
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        animeId: urlParams.get('animeId'),
        slug: urlParams.get('slug'),
        episode: urlParams.get('episode')
    };
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = 'v9';
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }

    loadEpisodeDetail();
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
        throw error;
    }
}

async function loadEpisodeDetail() {
    const params = getUrlParams();
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const episodeContent = document.getElementById('episodeContent');

    console.log('[V9] Loading episode detail:', params);

    if (!params.animeId || !params.slug || !params.episode) {
        showError('Parameter episode tidak lengkap');
        return;
    }

    try {
        showLoading();
        
        // Load episode data
        const episodeResponse = await fetchAPI(`/episode/${params.animeId}/${params.slug}/${params.episode}`);
        console.log('[V9] Episode data received:', episodeResponse);

        if (!episodeResponse || !episodeResponse.data) {
            throw new Error('Data episode tidak valid');
        }

        episodeData = episodeResponse.data;

        renderEpisodeDetail(episodeData);
        
        // Use episode_list from episode API (already contains episode list)
        if (episodeData.episode_list && episodeData.episode_list.length > 0) {
            renderEpisodeListFromApi(episodeData.episode_list);
        } else {
            // Fallback: Load anime detail for episode list
            try {
                const animeResponse = await fetchAPI(`/anime/${params.animeId}/${params.slug}`);
                console.log('[V9] Anime data received:', animeResponse);
                if (animeResponse && animeResponse.data) {
                    animeData = animeResponse.data;
                    renderEpisodeList(animeData?.episodes || []);
                }
            } catch (animeError) {
                console.warn('[V9] Could not load anime detail for episode list');
            }
        }
        
        showEpisodeContent();
    } catch (error) {
        console.error('[V9] Error loading episode:', error);
        showError('Gagal memuat episode: ' + error.message);
    }
}

function renderEpisodeDetail(data) {
    // Update document title
    document.title = `${data.anime_title || 'Anime'} - Episode ${data.episode} - AnimMe V9`;
    
    // Update breadcrumb
    document.getElementById('breadcrumbAnime').textContent = data.anime_title || 'Anime Detail';
    document.getElementById('breadcrumbAnime').href = `/v9/detail?animeId=${getUrlParams().animeId}&slug=${getUrlParams().slug}`;
    document.getElementById('breadcrumbEpisode').textContent = `Episode ${data.episode}`;

    // Episode title
    document.getElementById('episodeTitle').textContent = data.title || `Episode ${data.episode}`;
    const episodeBadge = document.getElementById('episodeBadge');
    if (episodeBadge) {
        episodeBadge.textContent = `Episode ${data.episode}`;
    }

    // Video player
    const videoPlayer = document.getElementById('videoPlayer');
    const videoFallback = document.getElementById('videoFallback');
    const directLink = document.getElementById('directLink');

    if (data.iframe_url) {
        videoPlayer.src = data.iframe_url;
        videoPlayer.style.display = 'block';
        videoFallback.style.display = 'none';
    } else if (data.streaming_servers && data.streaming_servers.length > 0) {
        // Try to get the first streaming source
        const firstSource = data.streaming_servers.find(server => 
            server.sources && server.sources.length > 0
        );
        
        if (firstSource) {
            const videoSrc = firstSource.sources[0].url;
            // For iframe sources, embed directly
            if (videoSrc.includes('iframe') || videoSrc.includes('embed')) {
                videoPlayer.src = videoSrc;
                videoPlayer.style.display = 'block';
                videoFallback.style.display = 'none';
            } else {
                // For direct video sources
                videoFallback.style.display = 'block';
                videoPlayer.style.display = 'none';
                directLink.href = videoSrc;
                directLink.textContent = 'Tonton Video';
            }
        } else {
            showVideoFallback();
        }
    } else {
        showVideoFallback();
    }

    // Navigation buttons
    setupNavigation(data);

    // Download links
    renderDownloadLinks(data.download_links || []);

    // Add event listeners
    setupEventListeners();
}

function showVideoFallback() {
    const videoPlayer = document.getElementById('videoPlayer');
    const videoFallback = document.getElementById('videoFallback');
    const directLink = document.getElementById('directLink');
    
    videoPlayer.style.display = 'none';
    videoFallback.style.display = 'block';
    directLink.href = '#';
    directLink.textContent = 'Video tidak tersedia';
    directLink.setAttribute('disabled', 'true');
}

function setupNavigation(data) {
    const prevBtn = document.getElementById('prevEpisode');
    const nextBtn = document.getElementById('nextEpisode');

    // Previous episode
    if (data.navigation && data.navigation.prev_episode) {
        prevBtn.style.display = 'block';
        prevBtn.onclick = () => {
            const prevMatch = data.navigation.prev_episode.match(/episode-(\d+)/);
            if (prevMatch) {
                goToEpisode(prevMatch[1]);
            }
        };
    } else {
        prevBtn.style.display = 'none';
    }

    // Next episode
    if (data.navigation && data.navigation.next_episode) {
        nextBtn.style.display = 'block';
        nextBtn.onclick = () => {
            const nextMatch = data.navigation.next_episode.match(/episode-(\d+)/);
            if (nextMatch) {
                goToEpisode(nextMatch[1]);
            }
        };
    } else {
        nextBtn.style.display = 'none';
    }
}

function goToEpisode(episodeNum) {
    const params = getUrlParams();
    window.location.href = `/v9/episode?animeId=${params.animeId}&slug=${params.slug}&episode=${episodeNum}`;
}

function renderDownloadLinks(downloadLinks) {
    const container = document.getElementById('downloadLinks');
    
    if (downloadLinks.length === 0) {
        container.innerHTML = '<div class="loading">Belum ada download link tersedia</div>';
        return;
    }

    // Group by quality
    const qualityGroups = {};
    downloadLinks.forEach(link => {
        const quality = link.quality || 'Unknown';
        if (!qualityGroups[quality]) {
            qualityGroups[quality] = [];
        }
        qualityGroups[quality].push(link);
    });

    container.innerHTML = Object.entries(qualityGroups).map(([quality, links]) => `
        <div class="download-item">
            <div class="download-quality">${quality}</div>
            <div class="download-links">
                ${links.map(link => `
                    <a href="${link.url}" target="_blank" class="download-btn">
                        ${link.provider || 'Download'} ${link.size ? `(${link.size})` : ''}
                    </a>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderEpisodeListFromApi(episodeList) {
    const container = document.getElementById('episodeList');
    
    if (!episodeList || episodeList.length === 0) {
        container.innerHTML = '<div class="loading">Belum ada episode tersedia</div>';
        return;
    }

    // Sort episodes by number (descending - latest first)
    const sortedEpisodes = [...episodeList].sort((a, b) => {
        const aNum = parseInt(a.episode) || 0;
        const bNum = parseInt(b.episode) || 0;
        return bNum - aNum;
    });

    const currentEpisode = parseInt(getUrlParams().episode);

    container.innerHTML = sortedEpisodes.map(episode => {
        const episodeNum = parseInt(episode.episode) || 0;
        const isCurrent = episodeNum === currentEpisode;
        
        return `
            <div class="episode-item ${isCurrent ? 'active' : ''}" 
                 onclick="goToEpisode(${episodeNum})">
                <h4>Episode ${episodeNum}</h4>
                <p>${episode.title || `Episode ${episodeNum}`}</p>
            </div>
        `;
    }).join('');
}

function renderEpisodeList(episodes) {
    const container = document.getElementById('episodeList');
    
    if (episodes.length === 0) {
        container.innerHTML = '<div class="loading">Belum ada episode tersedia</div>';
        return;
    }

    // Sort episodes by number (descending - latest first)
    const sortedEpisodes = episodes.sort((a, b) => {
        const aNum = parseInt(a.title.match(/Episode (\d+)/)?.[1] || 0);
        const bNum = parseInt(b.title.match(/Episode (\d+)/)?.[1] || 0);
        return bNum - aNum;
    });

    container.innerHTML = sortedEpisodes.map(episode => {
        const episodeNum = parseInt(episode.title.match(/Episode (\d+)/)?.[1] || 0);
        const currentEpisode = parseInt(getUrlParams().episode);
        const isCurrent = episodeNum === currentEpisode;
        
        return `
            <div class="episode-item ${isCurrent ? 'active' : ''}" 
                 onclick="goToEpisode(${episodeNum})">
                <h4>Episode ${episodeNum}</h4>
                <p>${episode.title}</p>
            </div>
        `;
    }).join('');
}

function setupEventListeners() {
    // Video error handling
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer) {
        videoPlayer.addEventListener('error', () => {
            console.warn('Video player error');
            showVideoFallback();
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && document.getElementById('prevEpisode').style.display !== 'none') {
            document.getElementById('prevEpisode').click();
        } else if (e.key === 'ArrowRight' && document.getElementById('nextEpisode').style.display !== 'none') {
            document.getElementById('nextEpisode').click();
        }
    });
}

function showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('episodeContent').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
}

function showEpisodeContent() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('episodeContent').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
}

function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('episodeContent').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
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

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });
}
