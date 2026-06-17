// Kusonime V8 Detail Page

const API_BASE = '/api/v8/kusonime';

// Fetch API helper
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// Get slug from URL
function getSlugFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug');
}

function formatSynopsis(synopsis) {
    if (!synopsis) {
        return '';
    }

    return synopsis
        .split(/\n{2,}/)
        .map(text => text.trim())
        .filter(Boolean)
        .map(text => `<p>${text}</p>`)
        .join('');
}

// Load anime detail
async function loadAnimeDetail() {
    const slug = getSlugFromURL();

    if (!slug) {
        document.getElementById('detailContent').innerHTML = '<div class="error">Slug tidak ditemukan</div>';
        return;
    }

    const detailContainer = document.getElementById('detailContent');

    try {
        const data = await fetchAPI(`/detail/${slug}`);

        if (!data || !data.data) {
            detailContainer.innerHTML = '<div class="error">Gagal memuat detail anime</div>';
            return;
        }

        const anime = data.data;

        // Build genres HTML
        const genresHTML = anime.genres && anime.genres.length > 0
            ? `<div class="genre-list">${anime.genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>`
            : '';

        // Build download links HTML
        let downloadHTML = '';
        if (anime.download_links && Object.keys(anime.download_links).length > 0) {
            downloadHTML = '<div class="download-section"><h2>📥 Download Links</h2>';

            for (const [quality, links] of Object.entries(anime.download_links)) {
                downloadHTML += `
                    <div class="download-quality">
                        <h3>${quality}</h3>
                        <div class="download-links">
                            ${links.map(link => `
                                <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="download-btn">
                                    ${link.host}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            downloadHTML += '</div>';
        } else {
            downloadHTML = `
                <div class="download-section">
                    <h2>📥 Download Links</h2>
                    <div class="empty-state">Link download belum tersedia atau gagal diparsing.</div>
                </div>
            `;
        }

        // Display detail
        detailContainer.innerHTML = `
            <div class="detail-header">
                <img src="${anime.poster || 'https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image'}"
                     alt="${anime.title}"
                     class="detail-poster"
                     onerror="this.src='https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image'">

                <div class="detail-info">
                    <h1 class="detail-title">${anime.title || 'Detail anime tidak ditemukan'}</h1>
                    ${anime.japanese_title ? `<p class="detail-subtitle">${anime.japanese_title}</p>` : ''}

                    <div class="detail-meta">
                        ${anime.type ? `<div class="meta-item"><span class="meta-label">Tipe:</span>${anime.type}</div>` : ''}
                        ${anime.status ? `<div class="meta-item"><span class="meta-label">Status:</span>${anime.status}</div>` : ''}
                        ${anime.total_episode ? `<div class="meta-item"><span class="meta-label">Episode:</span>${anime.total_episode}</div>` : ''}
                        ${anime.score ? `<div class="meta-item"><span class="meta-label">Score:</span>${anime.score}</div>` : ''}
                        ${anime.duration ? `<div class="meta-item"><span class="meta-label">Durasi:</span>${anime.duration}</div>` : ''}
                        ${anime.season ? `<div class="meta-item"><span class="meta-label">Season:</span>${anime.season}</div>` : ''}
                        ${anime.producer ? `<div class="meta-item"><span class="meta-label">Produser:</span>${anime.producer}</div>` : ''}
                        ${anime.release_date ? `<div class="meta-item"><span class="meta-label">Rilis:</span>${anime.release_date}</div>` : ''}
                    </div>

                    ${genresHTML}

                    ${anime.synopsis ? `
                        <div class="detail-synopsis">
                            <h3>Sinopsis</h3>
                            ${formatSynopsis(anime.synopsis)}
                        </div>
                    ` : ''}
                </div>
            </div>

            ${downloadHTML}
        `;

        document.title = `${anime.title} - Kusonime V8`;

    } catch (error) {
        console.error('Error loading detail:', error);
        detailContainer.innerHTML = '<div class="error">Gagal memuat detail anime</div>';
    }
}

// Search anime
function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput.value.trim();

    if (!keyword) {
        alert('Masukkan kata kunci pencarian!');
        return;
    }

    window.location.href = `/v8/search.html?q=${encodeURIComponent(keyword)}`;
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadAnimeDetail();
});
