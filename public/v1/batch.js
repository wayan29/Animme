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

function getBatchSlugFromURL() {
    const pathParts = window.location.pathname.split('/');
    
    // Clean URL: /batch/batch-slug
    if (pathParts.length >= 3 && pathParts[1] === 'batch' && pathParts[2]) {
        return pathParts[2];
    }
    
    return null;
}

async function loadBatchData() {
    const batchSlug = getBatchSlugFromURL();
    
    if (!batchSlug) {
        showError('Batch tidak ditemukan!');
        return;
    }
    
    const data = await fetchAPI(`/batch/${batchSlug}`);
    
    if (!data || !data.data) {
        showError('Data batch tidak ditemukan!');
        return;
    }
    
    displayBatchInfo(data.data);
}

function displayBatchInfo(batch) {
    const container = document.getElementById('batchContent');
    
    // Extract anime slug from detail URL for back link
    let animeSlug = '';
    if (batch.anime_detail_url) {
        const match = batch.anime_detail_url.match(/\/anime\/([^\/]+)/);
        animeSlug = match ? match[1] : '';
    }
    
    // Build genre tags
    let genreTags = '';
    if (batch.genres && batch.genres.length > 0) {
        genreTags = batch.genres.map(genre => 
            `<a href="/genre/${genre.slug}" class="genre-tag">${genre.name}</a>`
        ).join('');
    }
    
    // Build download section
    let downloadSection = '';
    if (batch.download_list && batch.download_list.length > 0) {
        downloadSection = `
            <div class="download-section">
                <h2 class="section-title">📥 Download Batch</h2>
                ${batch.total_episodes ? `
                    <div class="total-episodes">
                        Total Episode: <strong>${batch.total_episodes}</strong>
                    </div>
                ` : ''}
                <div class="download-list">
                    ${batch.download_list.map(item => `
                        <div class="download-item">
                            <div class="download-quality">
                                ${item.quality}
                                ${item.size ? `<span class="download-size">(${item.size})</span>` : ''}
                            </div>
                            <div class="download-links">
                                ${item.links.map(link => `
                                    <a href="${link.url}" target="_blank" class="download-btn">
                                        ${link.host}
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="anime-header">
            <div class="anime-poster">
                <img src="${batch.poster || '/placeholder.jpg'}" alt="${batch.title}">
            </div>
            <div class="anime-details">
                <h1 class="anime-title">${batch.title}</h1>
                ${batch.japanese_title ? `<p style="color: #999; font-size: 1.1rem; margin-bottom: 15px;">${batch.japanese_title}</p>` : ''}
                
                <div class="anime-info-grid">
                    ${batch.type ? `
                        <div class="info-item">
                            <span class="info-label">Tipe:</span>
                            <span class="info-value">${batch.type}</span>
                        </div>
                    ` : ''}
                    ${batch.total_episodes ? `
                        <div class="info-item">
                            <span class="info-label">Episode:</span>
                            <span class="info-value">${batch.total_episodes}</span>
                        </div>
                    ` : ''}
                    ${batch.rating ? `
                        <div class="info-item">
                            <span class="info-label">Rating:</span>
                            <span class="info-value">⭐ ${batch.rating}</span>
                        </div>
                    ` : ''}
                    ${batch.duration ? `
                        <div class="info-item">
                            <span class="info-label">Durasi:</span>
                            <span class="info-value">${batch.duration}</span>
                        </div>
                    ` : ''}
                    ${batch.studio ? `
                        <div class="info-item">
                            <span class="info-label">Studio:</span>
                            <span class="info-value">${batch.studio}</span>
                        </div>
                    ` : ''}
                    ${batch.aired ? `
                        <div class="info-item">
                            <span class="info-label">Tayang:</span>
                            <span class="info-value">${batch.aired}</span>
                        </div>
                    ` : ''}
                </div>
                
                ${genreTags ? `
                    <div class="genre-tags">
                        ${genreTags}
                    </div>
                ` : ''}
                
                ${batch.synopsis ? `
                    <div class="synopsis">
                        <strong>Sinopsis:</strong><br>
                        ${batch.synopsis}
                    </div>
                ` : ''}
                
                ${animeSlug ? `
                    <p style="margin-top: 15px;">
                        <a href="/detail/${animeSlug}" style="color: #e50914; text-decoration: none; font-weight: bold;">
                            → Lihat Episode Individu
                        </a>
                    </p>
                ` : ''}
            </div>
        </div>
        
        ${downloadSection}
    `;
}

function showError(message) {
    const container = document.getElementById('batchContent');
    container.innerHTML = `<div class="error">${message}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
    loadBatchData();
});
