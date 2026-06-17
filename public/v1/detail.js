const API_BASE = '/api';

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

function getSlugFromURL() {
    // Support both clean URL and query parameter
    const pathParts = window.location.pathname.split('/');
    
    // Clean URL: /detail/slug-name
    if (pathParts.length >= 3 && pathParts[1] === 'detail' && pathParts[2]) {
        return pathParts[2];
    }
    
    // Fallback to query parameter: /detail?slug=slug-name
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug');
}

async function fetchBatchDownload(batchSlug) {
    try {
        const data = await fetchAPI(`/batch/${batchSlug}`);
        return data;
    } catch (error) {
        console.error('Error fetching batch download:', error);
        return null;
    }
}

async function fetchRandomRecommendations(count = 18) {
    try {
        const firstPage = await fetchAPI('/complete-anime/1');
        if (!firstPage || !firstPage.data || !firstPage.data.completedAnimeData) {
            return [];
        }

        const pagination = firstPage.data.paginationData || {};
        const totalPages = Math.min(
            pagination.last_page || pagination.total_pages || pagination.last_visible_page || 1,
            64
        );

        const targetPage = totalPages > 1
            ? Math.floor(Math.random() * totalPages) + 1
            : 1;

        let pageData = firstPage;
        if (targetPage !== 1) {
            const fetched = await fetchAPI(`/complete-anime/${targetPage}`);
            if (fetched && fetched.data && fetched.data.completedAnimeData) {
                pageData = fetched;
            }
        }

        const list = (pageData.data && pageData.data.completedAnimeData) ? [...pageData.data.completedAnimeData] : [];
        const uniqueBySlug = new Map();
        list.forEach(item => {
            if (item && item.slug && !uniqueBySlug.has(item.slug)) {
                uniqueBySlug.set(item.slug, item);
            }
        });

        const candidates = Array.from(uniqueBySlug.values());
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        return candidates.slice(0, count);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return [];
    }
}

async function loadAnimeDetail() {
    const slug = getSlugFromURL();
    
    console.log('Current URL:', window.location.href);
    console.log('Pathname:', window.location.pathname);
    console.log('Extracted slug:', slug);
    
    if (!slug) {
        showError('Slug anime tidak ditemukan!');
        return;
    }
    
    console.log('Fetching anime data for slug:', slug);
    const data = await fetchAPI(`/anime/${slug}`);
    
    if (!data || !data.data) {
        showError('Detail anime tidak ditemukan!');
        return;
    }
    
    // Store anime data globally
    window.currentAnimeData = data.data;
    
    // Fetch batch data if available
    if (data.data.batch && data.data.batch.slug) {
        const batchData = await fetchAPI(`/batch/${data.data.batch.slug}`);
        window.currentBatchData = batchData ? batchData.data : null;
    }
    
    // Fetch recommendations - 18 anime for desktop (6 per row x 3 rows)
    const recommendations = await fetchRandomRecommendations(18);
    data.data.recommendations = recommendations;
    
    displayAnimeDetail(data.data);
}

async function showBatchDownload(slug) {
    const batchContainer = document.getElementById('batchDownloadContainer');
    
    // Check if batch data already exists from initial anime detail API
    const anime = window.currentAnimeData;
    if (anime && anime.batch && anime.batch.slug) {
        const batchSlug = anime.batch.slug;
        batchContainer.innerHTML = '<div class="loading">Memuat link download batch...</div>';
        batchContainer.style.display = 'block';
        
        const batchData = await fetchBatchDownload(batchSlug);
        
        if (batchData && batchData.data && batchData.data.downloadUrl) {
            displayBatchDownload(batchData.data);
        } else {
            batchContainer.innerHTML = '<div class="error">Download batch tidak tersedia</div>';
        }
    } else {
        batchContainer.innerHTML = '<div class="error">Batch download tidak tersedia untuk anime ini</div>';
        batchContainer.style.display = 'block';
    }
}

function displayBatchDownload(batchData) {
    const container = document.getElementById('batchDownloadContainer');
    
    if (!batchData.downloadUrl || !batchData.downloadUrl.formats) {
        container.innerHTML = '<div class="error">Download batch tidak tersedia</div>';
        return;
    }
    
    let downloadHTML = '<div class="batch-download-content">';
    
    batchData.downloadUrl.formats.forEach(format => {
        downloadHTML += `<div class="batch-format-section">`;
        downloadHTML += `<h3 class="batch-format-title">${format.title}</h3>`;
        
        format.qualities.forEach(quality => {
            downloadHTML += `
                <div class="quality-section">
                    <div class="quality-header">
                        <span class="quality-title">${quality.title}</span>
                        <span class="quality-size">${quality.size}</span>
                    </div>
                    <div class="download-links">
                        ${quality.urls.map(url => `
                            <a href="${url.url}" target="_blank" rel="noopener noreferrer" class="download-link-btn">
                                📥 ${url.title}
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        
        downloadHTML += `</div>`;
    });
    
    downloadHTML += '</div>';
    
    container.innerHTML = downloadHTML;
    container.style.display = 'block';
}

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    if (tabName === 'episodes') {
        document.getElementById('episodesTab').style.display = 'block';
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else if (tabName === 'batch') {
        document.getElementById('batchTab').style.display = 'block';
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        
        // Load batch data if not already loaded
        if (!window.batchDataLoaded && window.currentBatchData) {
            displayBatchInTab(window.currentBatchData);
            window.batchDataLoaded = true;
        }
    }
}

function displayBatchInTab(batchData) {
    const container = document.getElementById('batchDownloadContainer');
    
    if (!batchData || !batchData.download_list || batchData.download_list.length === 0) {
        container.innerHTML = '<div class="error">Download batch tidak tersedia</div>';
        return;
    }
    
    let downloadHTML = `
        <div class="batch-info">
            <h3 style="color: #e50914; margin-bottom: 15px;">Download Lengkap - ${batchData.total_episodes} Episode</h3>
            <p style="color: #999; margin-bottom: 25px;">Unduh semua episode sekaligus dalam satu file</p>
        </div>
        <div class="batch-download-list">
    `;
    
    batchData.download_list.forEach(item => {
        downloadHTML += `
            <div class="batch-quality-section">
                <div class="batch-quality-header">
                    <span class="quality-name">${item.quality}</span>
                    <span class="quality-size">${item.size}</span>
                </div>
                <div class="batch-download-links">
                    ${item.links.map(link => `
                        <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="batch-link-btn">
                            ${link.host}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    downloadHTML += `</div>`;
    container.innerHTML = downloadHTML;
}

function appendMetaItem(parent, label, value) {
    if (!value) return;
    const item = document.createElement('div');
    item.className = 'meta-item';
    const labelEl = document.createElement('span');
    labelEl.className = 'meta-label';
    labelEl.textContent = `${label}:`;
    item.appendChild(labelEl);
    item.appendChild(document.createTextNode(value));
    parent.appendChild(item);
}

function createRecommendationCard(rec) {
    const card = document.createElement('div');
    card.className = 'recommendation-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const openDetail = () => {
        if (rec.slug) {
            window.location.href = `/detail/${rec.slug}`;
        }
    };

    card.addEventListener('click', openDetail);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
        }
    });

    const poster = document.createElement('img');
    poster.src = rec.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image';
    poster.alt = rec.title || 'Anime poster';
    poster.className = 'recommendation-poster';
    poster.loading = 'lazy';
    poster.decoding = 'async';
    poster.addEventListener('error', () => {
        poster.src = 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image';
    });

    const info = document.createElement('div');
    info.className = 'recommendation-info';

    const title = document.createElement('div');
    title.className = 'recommendation-title';
    title.textContent = rec.title || 'Tanpa judul';
    title.title = rec.title || '';

    const meta = document.createElement('div');
    meta.className = 'recommendation-meta';
    const metaParts = [];
    if (rec.episode_count) metaParts.push(`${rec.episode_count} Episode`);
    if (rec.rating) metaParts.push(`⭐ ${rec.rating}`);
    meta.textContent = metaParts.join(' • ');

    info.appendChild(title);
    info.appendChild(meta);
    card.appendChild(poster);
    card.appendChild(info);
    return card;
}

function displayAnimeDetail(anime) {
    const container = document.getElementById('detailContent');
    container.replaceChildren();

    const hasBatch = anime.batch && anime.batch.slug;

    const header = document.createElement('div');
    header.className = 'detail-header';

    const poster = document.createElement('img');
    poster.src = anime.poster || 'https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image';
    poster.alt = anime.title || 'Anime poster';
    poster.className = 'detail-poster';
    poster.loading = 'lazy';
    poster.addEventListener('error', () => {
        poster.src = 'https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image';
    });

    const info = document.createElement('div');
    info.className = 'detail-info';

    const title = document.createElement('h1');
    title.textContent = anime.title || 'Anime';
    info.appendChild(title);

    if (anime.japanese_title) {
        const jpTitle = document.createElement('p');
        jpTitle.style.color = '#999';
        jpTitle.style.fontSize = '1rem';
        jpTitle.style.marginBottom = '15px';
        jpTitle.textContent = anime.japanese_title;
        info.appendChild(jpTitle);
    }

    const meta = document.createElement('div');
    meta.className = 'detail-meta';
    appendMetaItem(meta, 'Status', anime.status);
    appendMetaItem(meta, 'Rating', anime.rating);
    appendMetaItem(meta, 'Score', anime.score);
    appendMetaItem(meta, 'Rilis', anime.release_date);
    appendMetaItem(meta, 'Durasi', anime.duration);
    appendMetaItem(meta, 'Tipe', anime.type);
    appendMetaItem(meta, 'Studio', anime.studio);
    appendMetaItem(meta, 'Total Episode', anime.episode_count);
    appendMetaItem(meta, 'Produser', anime.produser);
    info.appendChild(meta);

    if (anime.genres && anime.genres.length > 0) {
        const genreList = document.createElement('div');
        genreList.className = 'genre-list';
        anime.genres.forEach((genre) => {
            const genreName = typeof genre === 'object' ? genre.name : genre;
            const genreSlug = typeof genre === 'object' && genre.slug
                ? genre.slug
                : String(genreName).toLowerCase();
            const tag = document.createElement('span');
            tag.className = 'genre-tag';
            tag.textContent = genreName;
            tag.addEventListener('click', () => goToGenre(genreSlug));
            genreList.appendChild(tag);
        });
        info.appendChild(genreList);
    }

    if (anime.synopsis) {
        const synopsisWrap = document.createElement('div');
        synopsisWrap.className = 'detail-synopsis';
        const synopsisTitle = document.createElement('h3');
        synopsisTitle.textContent = 'Sinopsis';
        const synopsisText = document.createElement('p');
        synopsisText.textContent = anime.synopsis;
        synopsisWrap.appendChild(synopsisTitle);
        synopsisWrap.appendChild(synopsisText);
        info.appendChild(synopsisWrap);
    }

    header.appendChild(poster);
    header.appendChild(info);
    container.appendChild(header);

    const tabs = document.createElement('div');
    tabs.className = 'tabs-container';

    const tabsHeader = document.createElement('div');
    tabsHeader.className = 'tabs-header';

    const episodesTabBtn = document.createElement('button');
    episodesTabBtn.type = 'button';
    episodesTabBtn.className = 'tab-btn active';
    episodesTabBtn.textContent = '📺 Episodes';
    episodesTabBtn.addEventListener('click', () => switchTab('episodes'));
    tabsHeader.appendChild(episodesTabBtn);

    if (hasBatch) {
        const batchTabBtn = document.createElement('button');
        batchTabBtn.type = 'button';
        batchTabBtn.className = 'tab-btn';
        batchTabBtn.textContent = '📥 Download Batch';
        batchTabBtn.addEventListener('click', () => switchTab('batch'));
        tabsHeader.appendChild(batchTabBtn);
    }

    const episodesTab = document.createElement('div');
    episodesTab.className = 'tab-content active';
    episodesTab.id = 'episodesTab';

    if (anime.episode_lists && anime.episode_lists.length > 0) {
        const episodeSection = document.createElement('div');
        episodeSection.className = 'episode-section';
        const episodeTitle = document.createElement('h2');
        episodeTitle.className = 'section-title';
        episodeTitle.textContent = `Daftar Episode (${anime.episode_lists.length})`;
        const episodeList = document.createElement('div');
        episodeList.className = 'episode-list';

        anime.episode_lists.forEach((ep) => {
            const epNum = ep.episode_number || 'N/A';
            const needsPrefix = /^OVA|^Movie|^Special/i.test(epNum);
            const displayText = needsPrefix ? epNum : `Episode ${epNum}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'episode-btn';
            button.textContent = displayText;
            button.addEventListener('click', () => goToEpisode(ep.slug));
            episodeList.appendChild(button);
        });

        episodeSection.appendChild(episodeTitle);
        episodeSection.appendChild(episodeList);
        episodesTab.appendChild(episodeSection);
    } else {
        const empty = document.createElement('p');
        empty.className = 'error';
        empty.textContent = 'Tidak ada episode tersedia';
        episodesTab.appendChild(empty);
    }

    tabs.appendChild(tabsHeader);
    tabs.appendChild(episodesTab);

    if (hasBatch) {
        const batchTab = document.createElement('div');
        batchTab.className = 'tab-content';
        batchTab.id = 'batchTab';
        batchTab.style.display = 'none';

        const batchContainer = document.createElement('div');
        batchContainer.id = 'batchDownloadContainer';
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = 'Memuat download batch...';
        batchContainer.appendChild(loading);
        batchTab.appendChild(batchContainer);
        tabs.appendChild(batchTab);
    }

    container.appendChild(tabs);

    if (anime.recommendations && anime.recommendations.length > 0) {
        const recommendationSection = document.createElement('div');
        recommendationSection.className = 'recommendation-section';

        const recommendationTitle = document.createElement('h2');
        recommendationTitle.className = 'section-title';
        recommendationTitle.textContent = '🎬 Rekomendasi Anime Lainnya';

        const recommendationGrid = document.createElement('div');
        recommendationGrid.className = 'recommendation-grid';
        anime.recommendations.forEach((rec) => {
            recommendationGrid.appendChild(createRecommendationCard(rec));
        });

        recommendationSection.appendChild(recommendationTitle);
        recommendationSection.appendChild(recommendationGrid);
        container.appendChild(recommendationSection);
    }
}

function goToEpisode(episodeSlug) {
    if (episodeSlug) {
        window.location.href = `/player/${episodeSlug}`;
    }
}

function goToGenre(genreSlug) {
    if (genreSlug) {
        window.location.href = `/genre/${genreSlug}`;
    }
}

function showError(message) {
    const container = document.getElementById('detailContent');
    container.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.className = 'error-state';
    const text = document.createElement('p');
    text.className = 'error';
    text.textContent = message;
    wrapper.appendChild(text);

    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'retry-btn';
    retryButton.textContent = 'Coba Lagi';
    retryButton.addEventListener('click', loadAnimeDetail);
    wrapper.appendChild(retryButton);

    container.appendChild(wrapper);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAnimeDetail();
});
