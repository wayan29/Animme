const API_BASE = '/api';

async function fetchGenres() {
    try {
        const response = await fetch(`${API_BASE}/genres`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching genres:', error);
        return null;
    }
}

function goToGenre(slug, name) {
    if (slug) {
        window.location.href = `/genre/${slug}?name=${encodeURIComponent(name || slug)}`;
    }
}

function createGenreCard(genre) {
    const card = document.createElement('div');
    card.className = 'genre-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const openGenre = () => goToGenre(genre.slug, genre.name);
    card.addEventListener('click', openGenre);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openGenre();
        }
    });

    const content = document.createElement('div');
    content.className = 'genre-card-content';

    const title = document.createElement('h3');
    title.className = 'genre-card-title';
    title.textContent = genre.name || genre.slug || 'Genre';

    const arrow = document.createElement('span');
    arrow.className = 'genre-card-arrow';
    arrow.textContent = '→';

    content.appendChild(title);
    content.appendChild(arrow);
    card.appendChild(content);
    return card;
}

function displayGenres(genres) {
    const container = document.getElementById('genreContainer');
    container.replaceChildren();

    if (!genres || genres.length === 0) {
        showListError(container, 'Tidak ada data genre');
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'genre-grid';
    genres.forEach((genre) => {
        grid.appendChild(createGenreCard(genre));
    });
    container.appendChild(grid);
}

async function loadGenresPage() {
    const container = document.getElementById('genreContainer');
    showListLoading(container, 'Memuat daftar genre...');

    const data = await fetchGenres();
    if (data && data.data) {
        displayGenres(data.data);
    } else {
        showListError(container, 'Gagal memuat daftar genre', loadGenresPage);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadGenresPage();
});