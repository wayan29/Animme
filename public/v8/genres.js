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

async function loadGenres() {
    const container = document.getElementById('genresContainer');
    const badge = document.getElementById('genreCountBadge');
    const response = await fetchAPI('/genres');

    if (!response || !response.data) {
        container.innerHTML = '<div class="error">Gagal memuat daftar genre.</div>';
        return;
    }

    const genres = response.data.genres || [];
    if (badge) {
        badge.textContent = `${genres.length} genre`;
    }

    if (!genres.length) {
        container.innerHTML = '<div class="error">Tidak ada genre tersedia.</div>';
        return;
    }

    container.className = 'menu-grid';
    container.innerHTML = genres.map(genre => `
        <a class="menu-card" href="/v8/anime-list?genre=${encodeURIComponent(genre.slug)}&name=${encodeURIComponent(genre.name)}">
            <strong>${genre.name}</strong>
            <span>Buka daftar anime genre ini</span>
        </a>
    `).join('');
}

function searchAnime() {
    const keyword = document.getElementById('searchInput').value.trim();
    if (!keyword) {
        alert('Masukkan kata kunci pencarian!');
        return;
    }

    window.location.href = `/v8/search.html?q=${encodeURIComponent(keyword)}`;
}

document.addEventListener('DOMContentLoaded', loadGenres);
