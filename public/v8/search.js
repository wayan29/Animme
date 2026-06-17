const API_BASE = '/api/v8/kusonime';

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

function getKeyword() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('q') || '').trim();
}

function renderCardList(items) {
    return `
        <div class="catalog-grid">
            ${items.map(item => `
                <div class="catalog-card" onclick="goToDetail('${item.slug}')">
                    <div class="catalog-thumb">
                        <img src="${item.poster || 'https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image'}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/300x400/0f0f0f/e50914?text=No+Image'">
                    </div>
                    <div class="catalog-info">
                        <div class="catalog-title">${item.title}</div>
                        <div class="catalog-meta">
                            <span class="meta-pill">${item.release_date || 'Unknown'}</span>
                        </div>
                        <div class="catalog-meta">
                            ${(item.genres || []).slice(0, 3).map(genre => `<span class="genre-tag">${genre}</span>`).join('')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadSearchResults() {
    const keyword = getKeyword();
    const pageTitle = document.getElementById('pageTitle');
    const pageDescription = document.getElementById('pageDescription');
    const sectionTitle = document.getElementById('sectionTitle');
    const countBadge = document.getElementById('countBadge');
    const resultsContainer = document.getElementById('resultsContainer');
    const searchInput = document.getElementById('searchInput');

    if (!keyword) {
        resultsContainer.innerHTML = '<div class="empty-state">Masukkan kata kunci pencarian terlebih dahulu.</div>';
        return;
    }

    searchInput.value = keyword;
    pageTitle.textContent = `Hasil pencarian: ${keyword}`;
    pageDescription.textContent = `Menampilkan anime batch Kusonime yang cocok dengan kata kunci "${keyword}".`;
    sectionTitle.textContent = `Pencarian: ${keyword}`;

    const response = await fetchAPI(`/search?q=${encodeURIComponent(keyword)}`);
    if (!response || !response.data) {
        resultsContainer.innerHTML = '<div class="error">Gagal memuat hasil pencarian.</div>';
        return;
    }

    const results = response.data.results || [];
    countBadge.textContent = `${results.length} item`;

    if (!results.length) {
        resultsContainer.innerHTML = `<div class="empty-state">Tidak ada hasil untuk <strong>${keyword}</strong>.</div>`;
        return;
    }

    resultsContainer.innerHTML = renderCardList(results);
}

function goToDetail(slug) {
    window.location.href = `/v8/detail.html?slug=${slug}`;
}

function searchAnime() {
    const keyword = document.getElementById('searchInput').value.trim();
    if (!keyword) {
        alert('Masukkan kata kunci pencarian!');
        return;
    }

    window.location.href = `/v8/search?q=${encodeURIComponent(keyword)}`;
}

document.addEventListener('DOMContentLoaded', loadSearchResults);
