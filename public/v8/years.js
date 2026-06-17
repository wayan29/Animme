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

async function loadYears() {
    const container = document.getElementById('yearsContainer');
    const badge = document.getElementById('yearCountBadge');
    const response = await fetchAPI('/seasons');

    if (!response || !response.data) {
        container.innerHTML = '<div class="error">Gagal memuat daftar tahun rilis.</div>';
        return;
    }

    const seasons = response.data.seasons || [];
    if (badge) {
        badge.textContent = `${seasons.length} musim`;
    }

    if (!seasons.length) {
        container.innerHTML = '<div class="error">Tidak ada tahun rilis tersedia.</div>';
        return;
    }

    const grouped = seasons.reduce((acc, item) => {
        const year = item.year || 'Lainnya';
        if (!acc[year]) {
            acc[year] = [];
        }
        acc[year].push(item);
        return acc;
    }, {});

    container.className = 'year-groups';
    container.innerHTML = Object.entries(grouped).map(([year, items]) => `
        <section class="year-group">
            <div class="year-heading">
                <h3>${year}</h3>
                <span class="year-count">${items.length} musim</span>
            </div>
            <div class="menu-grid">
                ${items.map(item => `
                    <a class="menu-card" href="/v8/anime-list?season=${encodeURIComponent(item.slug)}&name=${encodeURIComponent(item.name)}">
                        <strong>${item.name}</strong>
                        <span>Buka daftar anime musim ini</span>
                    </a>
                `).join('')}
            </div>
        </section>
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

document.addEventListener('DOMContentLoaded', loadYears);
