const API_BASE = '/api';

let currentPage = 1;
let currentGenreSlug = '';
let currentGenreName = '';

async function fetchAnimeByGenre(slug, page = 1) {
    try {
        const response = await fetch(`${API_BASE}/genre/${slug}/${page}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching anime by genre:', error);
        return null;
    }
}

function goToDetail(slug) {
    if (slug) {
        window.location.href = `/detail/${slug}`;
    }
}

async function loadPage(page) {
    currentPage = page;
    const container = document.getElementById('genreAnimeContainer');
    showListLoading(container, `Memuat halaman ${page}...`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const response = await fetchAnimeByGenre(currentGenreSlug, page);

    if (response && response.status === 'success' && response.data) {
        if (response.data.genreAnimeData) {
            renderGridAnimeList(container, response.data.genreAnimeData, {
                onOpen: goToDetail,
                emptyMessage: 'Tidak ada anime untuk genre ini'
            });
            renderPagination(
                document.getElementById('paginationContainer'),
                response.data.paginationData,
                loadPage
            );
            return;
        }

        if (Array.isArray(response.data)) {
            renderGridAnimeList(container, response.data, {
                onOpen: goToDetail,
                emptyMessage: 'Tidak ada anime untuk genre ini'
            });
            renderPagination(document.getElementById('paginationContainer'), null, loadPage);
            return;
        }

        showListError(container, 'Format data tidak sesuai', () => loadPage(page));
        return;
    }

    showListError(container, 'Gagal memuat data anime', () => loadPage(page));
}

async function loadGenrePage() {
    const pathParts = window.location.pathname.split('/');
    const urlParams = new URLSearchParams(window.location.search);

    if (pathParts.length >= 3 && pathParts[1] === 'genre' && pathParts[2]) {
        currentGenreSlug = pathParts[2];
    } else {
        currentGenreSlug = urlParams.get('slug');
    }

    currentGenreName = urlParams.get('name') || currentGenreSlug;
    const page = parseInt(urlParams.get('page'), 10) || 1;

    if (!currentGenreSlug) {
        window.location.href = 'genres';
        return;
    }

    document.getElementById('genreName').textContent = `Genre: ${currentGenreName}`;
    document.getElementById('genreDescription').textContent = `Daftar anime dengan genre ${currentGenreName}`;
    document.title = `Genre ${currentGenreName} - AnimMe`;

    await loadPage(page);
}

document.addEventListener('DOMContentLoaded', () => {
    loadGenrePage();
});