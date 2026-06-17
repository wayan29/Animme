const API_BASE = '/api/v2';

let currentAnimeData = null;
let currentSlug = null;

// Get slug from URL
function getSlugFromURL() {
    const pathParts = window.location.pathname.split('/');
    
    // Clean URL: /detail-v2/slug-name
    if (pathParts.length >= 3 && pathParts[1] === 'detail-v2' && pathParts[2]) {
        return pathParts[2];
    }
    
    // Fallback to query parameter
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug');
}

// Check if user prefers V2
function isV2Server() {
    const savedServer = localStorage.getItem('selectedServer') || 'v1';
    return savedServer === 'v2';
}

// Redirect to V2 detail if user is on V2 server
function checkServerPreference() {
    if (!isV2Server()) {
        const slug = getSlugFromURL();
        if (slug) {
            window.location.href = `/detail-v2/${slug}`;
        }
    }
}

async function fetchAnimeDetail(slug) {
    try {
        const response = await fetch(`${API_BASE}/anime/${slug}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching anime detail:', error);
        showNotification('Error loading anime data');
        return null;
    }
}

function displayAnimeDetail(anime) {
    const container = document.getElementById('detailContent');
    
    const genres = anime.genres ? anime.genres.map(g => {
        const genreName = typeof g === 'object' ? g.name : g;
        const genreSlug = typeof g === 'object' && g.slug ? g.slug : genreName.toLowerCase();
        return `<span class="genre-tag" onclick="goToGenre('${genreSlug}')">${genreName}</span>`;
    }).join('') : '';
    
    // Check if batch download is available
    const hasBatch = anime.batch && anime.batch.slug;
    
    const episodeList = anime.episode_lists && anime.episode_lists.length > 0 ? `
        <div class="episode-section">
            <h2 class="section-title">Daftar Episode (${anime.episode_lists.length})</h2>
            <div class="episode-list">
                ${anime.episode_lists.map(ep => {
                    // Check if episode_number already contains "Episode", "OVA", "Movie", or "Special"
                    const epNum = ep.episode_number || 'N/A';
                    const needsPrefix = /^OVA|^Movie|^Special/i.test(epNum);
                    const displayText = needsPrefix ? epNum : `Episode ${epNum}`;
                    
                    return `
                        <button class="episode-btn" onclick="goToEpisode('${ep.slug}')">
                            ${displayText}
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    ` : '<p class="error">Tidak ada episode tersedia</p>';
    
    container.innerHTML = `
        <div class="detail-header">
            <img src="${anime.poster || 'https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image'}" 
                 alt="${anime.title}" 
                 class="detail-poster"
                 onerror="this.src='https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image'">
            
            <div class="detail-info">
                <h1>${anime.title}</h1>
                ${anime.japanese_title ? `<p style="color: #999; font-size: 1rem; margin-bottom: 15px;">${anime.japanese_title}</p>` : ''}
                
                <div class="detail-meta">
                    ${anime.status ? `<div class="meta-item"><span class="meta-label">Status:</span>${anime.status}</div>` : ''}
                    ${anime.rating ? `<div class="meta-item"><span class="meta-label">Rating:</span>${anime.rating}</div>` : ''}
                    ${anime.score ? `<div class="meta-item"><span class="meta-label">Score:</span>${anime.score}</div>` : ''}
                    ${anime.release_date ? `<div class="meta-item"><span class="meta-label">Rilis:</span>${anime.release_date}</div>` : ''}
                    ${anime.duration ? `<div class="meta-item"><span class="meta-label">Durasi:</span>${anime.duration}</div>` : ''}
                    ${anime.type ? `<div class="meta-item"><span class="meta-label">Tipe:</span>${anime.type}</div>` : ''}
                    ${anime.studio ? `<div class="meta-item"><span class="meta-label">Studio:</span>${anime.studio}</div>` : ''}
                    ${anime.episode_count ? `<div class="meta-item"><span class="meta-label">Total Episode:</span>${anime.episode_count}</div>` : ''}
                    ${anime.produser ? `<div class="meta-item"><span class="meta-label">Produser:</span>${anime.produser}</div>` : ''}
                </div>
                
                ${genres ? `<div class="genre-list">${genres}</div>` : ''}
                
                ${anime.synopsis ? `
                    <div class="detail-synopsis">
                        <h3>Sinopsis</h3>
                        <p>${anime.synopsis}</p>
                    </div>
                ` : ''}
                
            </div>
        </div>
        
        <!-- Tabs untuk Episodes dan Batch Download -->
        <div class="tabs-container">
            <div class="tabs-header">
                <button class="tab-btn active" onclick="switchTab('episodes')">📺 Episodes</button>
                ${hasBatch ? `<button class="tab-btn" onclick="switchTab('batch')">📥 Download Batch</button>` : ''}
            </div>
            
            <div class="tab-content active" id="episodesTab">
                ${episodeList}
            </div>
            
            ${hasBatch ? `
                <div class="tab-content" id="batchTab" style="display: none;">
                    <div id="batchDownloadContainer">
                        <div class="loading">Memuat download batch...</div>
                    </div>
                </div>
            ` : ''}
        
        ${anime.recommendations && anime.recommendations.length > 0 ? `
            <div class="recommendation-section">
                <h2 class="section-title">🎬 Rekomendasi Anime Lainnya</h2>
                <div class="recommendation-grid">
                    ${anime.recommendations.map(rec => `
                        <div class="recommendation-card" onclick="window.location.href='/detail-v2/${rec.slug}'">
                            <img src="${rec.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}" 
                                 alt="${rec.title}" 
                                 class="recommendation-poster"
                                 onerror="this.src='https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'">
                            <div class="recommendation-info">
                                <div class="recommendation-title" title="${rec.title}">${rec.title}</div>
                                <div class="recommendation-meta">
                                    ${rec.episode_count ? rec.episode_count + ' Episode' : ''}
                                    ${rec.rating ? ' • ⭐ ' + rec.rating : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

function goToEpisode(episodeSlug) {
    if (episodeSlug) {
        window.location.href = `/player-v2/${episodeSlug}`;
    }
}

function goToGenre(genreSlug) {
    if (genreSlug) {
        // Redirect to all-anime with genre filter
        window.location.href = `/all-anime?genre=${genreSlug}&server=v2`;
    }
}

function switchTab(tabName) {
    // Hide all tabs
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => tab.style.display = 'none');
    
    // Remove active class from all buttons
    const allButtons = document.querySelectorAll('.tab-btn');
    allButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    const selectedTab = document.getElementById(`${tabName}Tab`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

async function displayRelatedAnime() {
    const relatedContainer = document.getElementById('relatedAnime');
    const slug = currentSlug;
    
    if (!slug) {
        relatedContainer.innerHTML = '<div class="loading">Loading related anime...</div>';
        return;
    }
    
    try {
        // Use search to find related anime (same genre anime)
        const response = await fetchAnimeDetail('');
        
        if (response && response.status === 'success' && response.data) {
            relatedContainer.innerHTML = '<div class="loading">No related anime available.</div>';
        }
    } catch (error) {
        relatedContainer.innerHTML = '<div class="error">Failed to load related anime.</div>';
    }
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function goBack() {
    // Check if there's a referrer
    if (document.referrer && document.referrer !== window.location.href) {
        window.history.back();
    } else {
        window.location.href = '/v2/home';
    }
}

async function fetchRandomRecommendations(count = 6) {
    try {
        // Fetch terbaru anime for recommendations from V2
        const data = await fetch(`${API_BASE}/terbaru/1`);
        
        if (!data.ok) {
            throw new Error(`HTTP error! status: ${data.status}`);
        }
        
        const response = await data.json();
        
        if (!response || !response.data || !response.data.animeData) {
            return [];
        }
        
        const allAnime = response.data.animeData;
        
        // Shuffle array and pick random items (exclude current anime if exists)
        const shuffled = [...allAnime].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return [];
    }
}

async function loadAnimeDetailPage() {
    const slug = getSlugFromURL();
    
    if (!slug) {
        showError('Slug tidak ditemukan');
        return;
    }
    
    showLoading('Loading anime detail...');
    
    const data = await fetchAnimeDetail(slug);
    
    if (data && data.status === 'success' && data.data) {
        // Fetch recommendations
        const recommendations = await fetchRandomRecommendations(6);
        data.data.recommendations = recommendations;
        
        currentSlug = slug;
        displayAnimeDetail(data.data);
        document.title = `${data.data.title} - AnimMe V2`;
        
        hideLoading();
    } else {
        hideLoading();
        showError('Gagal memuat detail anime');
    }
}

function showLoading(message) {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(el => el.textContent = message);
}

function hideLoading() {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(el => {
        el.textContent = '';
        });
}

function showError(message) {
    const detailContainer = document.querySelector('.detail-container');
    if (detailContainer) {
        detailContainer.innerHTML = `<div class="error">${message}</div>`;
    }
}

function searchAnime() {
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
        window.location.href = `/search/${query}?server=v2`;
    }
}

// Handle Enter key in search input
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAnime();
            }
        });
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadAnimeDetailPage();
});
