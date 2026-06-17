const API_BASE = '/api';

let currentPage = 1;

async function fetchCompletedAnime(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/complete-anime/${page}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching completed anime:', error);
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
    const container = document.getElementById('completedContainer');
    showListLoading(container, `Memuat halaman ${page}...`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const response = await fetchCompletedAnime(page);

    if (response && response.status === 'success' && response.data) {
        const animeList = response.data.completedAnimeData || response.data;
        renderAnimeList(container, Array.isArray(animeList) ? animeList : [], {
            onOpen: goToDetail,
            dateLabel: 'Tamat',
            buildMeta: (anime) => {
                let info = `${anime.episode_count || 'N/A'} Episode`;
                if (anime.rating) {
                    info += ` • ⭐ ${anime.rating}`;
                }
                return info;
            }
        });
        renderPagination(
            document.getElementById('paginationContainer'),
            response.data.paginationData || null,
            loadPage
        );
        return;
    }

    showListError(container, 'Gagal memuat data anime tamat', () => loadPage(page));
}

async function loadCompletedPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page'), 10) || 1;
    await loadPage(page);
}

document.addEventListener('DOMContentLoaded', () => {
    loadCompletedPage();
});