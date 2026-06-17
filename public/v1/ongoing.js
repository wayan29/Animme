const API_BASE = '/api';

let currentPage = 1;

async function fetchOngoingAnime(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/ongoing-anime/${page}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching ongoing anime:', error);
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
    const container = document.getElementById('ongoingContainer');
    showListLoading(container, `Memuat halaman ${page}...`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const response = await fetchOngoingAnime(page);

    if (response && response.status === 'success' && response.data) {
        const animeList = response.data.ongoingAnimeData || response.data;
        renderAnimeList(container, Array.isArray(animeList) ? animeList : [], {
            onOpen: goToDetail,
            dateLabel: 'Update',
            buildMeta: (anime) => {
                const parts = [];
                parts.push(anime.current_episode ? `Ep ${anime.current_episode}` : 'Episode N/A');
                if (anime.release_day) {
                    parts.push(anime.release_day);
                } else if (anime.release_date) {
                    parts.push(anime.release_date);
                }
                return parts.join(' • ');
            }
        });
        renderPagination(
            document.getElementById('paginationContainer'),
            response.data.paginationData || null,
            loadPage
        );
        return;
    }

    showListError(container, 'Gagal memuat data anime ongoing', () => loadPage(page));
}

async function loadOngoingPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page'), 10) || 1;
    await loadPage(page);
}

document.addEventListener('DOMContentLoaded', () => {
    loadOngoingPage();
});