const API_BASE = '/api/v2';

let currentPage = 1;
let selectedServer = localStorage.getItem('selectedServer') || 'v2';

async function fetchAnimeList(page = 1, pagesToLoad = 1) {
    try {
        let url = `${API_BASE}/terbaru/${page}`;
        if (pagesToLoad > 1) {
            url += `?pages=${pagesToLoad}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching anime list:', error);
        return null;
    }
}

function buildTerbaruMeta(anime) {
    if (anime.current_episode) {
        return `Episode ${anime.current_episode}`;
    }
    return 'Rilis terbaru';
}

async function loadPage(page) {
    currentPage = page;

    const container = document.getElementById('animeListContainer');
    showListLoading(container, `Memuat halaman ${page}...`);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const itemsPreference = localStorage.getItem('animeListItemsPerPage') || '1';
    const pagesToLoad = parseInt(itemsPreference, 10) || 1;

    const response = await fetchAnimeList(page, pagesToLoad);

    if (response && response.status === 'success' && response.data) {
        const animeList = response.data.animeData || (Array.isArray(response.data) ? response.data : null);
        const pagination = response.data.paginationData || null;

        renderAnimeList(container, animeList, {
            onOpen: goToDetail,
            emptyMessage: 'Tidak ada data anime terbaru',
            dateLabel: 'Rilis',
            buildMeta: buildTerbaruMeta
        });

        renderPagination(
            document.getElementById('paginationContainer'),
            pagination,
            loadPage
        );

        if (pagination && pagination.current_page) {
            currentPage = pagination.current_page;
        }
        return;
    }

    showListError(container, 'Gagal memuat data anime terbaru', () => loadPage(page));
}

function goToDetail(slug) {
    if (slug) {
        window.location.href = `/detail-v2/${slug}`;
    }
}

function changeServer(server) {
    selectedServer = server;
    localStorage.setItem('selectedServer', server);
    applyServerClass();
    showNotification(`Server berubah ke ${server === 'v1' ? 'V1 (Otakudesu)' : 'V2 (Samehadaku)'}`);
}

function applyServerClass() {
    const body = document.body;
    body.classList.remove('server-v1', 'server-v2');
    body.classList.add(`server-${selectedServer}`);

    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = selectedServer;
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function searchAnime() {
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
        window.location.href = `/search-v2/${encodeURIComponent(query)}`;
    }
}

function onItemsPerPageChange(value) {
    localStorage.setItem('animeListItemsPerPage', value);
    loadPage(currentPage);
}

async function loadAnimeListPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page'), 10) || 1;

    const serverFromStorage = localStorage.getItem('selectedServer');
    if (serverFromStorage) {
        selectedServer = serverFromStorage;
    }
    applyServerClass();

    await loadPage(page);
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAnime();
            }
        });
    }

    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }

    const itemsPerPage = document.getElementById('itemsPerPage');
    if (itemsPerPage) {
        itemsPerPage.value = localStorage.getItem('animeListItemsPerPage') || '1';
        itemsPerPage.addEventListener('change', (e) => {
            onItemsPerPageChange(e.target.value);
        });
    }

    loadAnimeListPage();
});
