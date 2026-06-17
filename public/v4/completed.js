const API_BASE = '/api/v4/anichin';
const PLACEHOLDER_POSTER = '/images/placeholder.jpg';

let paginationState = {
    current: 1,
    total: 1,
    next: null,
    prev: null
};

let isLoading = false;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[V4] Completed page initializing...');
    setupServerSelector();
    initSidebarToggle();
    initMobileSearch();
    attachPaginationHandlers();
    loadCompletedList(1);
});

function setupServerSelector() {
    const selector = document.getElementById('serverSelect');
    if (!selector) return;

    selector.value = 'v4';
    selector.addEventListener('change', (event) => {
        changeServer(event.target.value);
    });
}

function changeServer(server) {
    switch (server) {
        case 'v1':
            window.location.href = '/v1/home';
            break;
        case 'v2':
            window.location.href = '/v2/home';
            break;
        case 'v3':
            window.location.href = '/v3/home';
            break;
        default:
            window.location.href = '/v4/home';
    }
}

function attachPaginationHandlers() {
    const prevBtn = document.getElementById('paginationPrev');
    const nextBtn = document.getElementById('paginationNext');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (isLoading || !paginationState.prev) return;
            loadCompletedList(paginationState.prev);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (isLoading || !paginationState.next) return;
            loadCompletedList(paginationState.next);
        });
    }
}

async function loadCompletedList(page = 1) {
    const listContainer = document.getElementById('completedList');
    if (!listContainer) return;

    isLoading = true;
    showLoadingState(listContainer);
    hideError();

    try {
        const response = await fetch(`${API_BASE}/completed?page=${page}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (payload.status !== 'success') {
            throw new Error(payload.message || 'Gagal memuat data completed');
        }

        const data = payload.data || {};
        const list = data.list || [];

        renderCompletedList(list);
        updateSummary(list.length, data);
        updatePagination(data);
    } catch (error) {
        console.error('[V4] Completed load error:', error);
        showError('Tidak dapat memuat daftar completed. Silakan coba lagi beberapa saat.');
        listContainer.innerHTML = '<div class="error">Gagal memuat data completed.</div>';
    } finally {
        isLoading = false;
        refreshPaginationButtons();
    }
}

function renderCompletedList(list) {
    const listContainer = document.getElementById('completedList');
    if (!listContainer) return;

    if (!Array.isArray(list) || list.length === 0) {
        listContainer.innerHTML = '<div class="loading">Belum ada data completed yang tersedia.</div>';
        return;
    }

    listContainer.innerHTML = list.map(item => createCompletedCard(item)).join('');
}

function createCompletedCard(item) {
    const slug = item?.slug || '';
    const title = escapeHtml(item?.title || 'Unknown Title');
    const poster = escapeHtml(item?.poster || PLACEHOLDER_POSTER);
    const detailUrl = slug ? `/v4/detail?slug=${encodeURIComponent(slug)}` : '#';
    const type = escapeHtml(item?.type || '');
    const subtitle = escapeHtml(item?.subtitle || '');
    const episodeText = escapeHtml(item?.episode_text || item?.status || 'Completed');

    return `
        <a href="${detailUrl}" class="anime-card">
            <div class="anime-poster" style="background-image: url('${poster}');"></div>
            <div class="anime-info">
                <div class="anime-title" title="${title}">${title}</div>
                <div class="anime-meta">
                    ${episodeText ? `<span class="badge">${episodeText}</span>` : ''}
                    ${type ? `<span class="badge sub-badge">${type}</span>` : ''}
                    ${subtitle ? `<span class="badge sub-badge">${subtitle}</span>` : ''}
                </div>
            </div>
        </a>
    `;
}

function updateSummary(count, data) {
    const badge = document.getElementById('totalBadge');
    if (badge) {
        badge.textContent = `${count} Judul`;
    }
}

function updatePagination(pagination) {
    const pageInfo = document.getElementById('pageInfo');
    const current = parseInt(pagination?.page, 10) || 1;
    const total = parseInt(pagination?.total_pages, 10) || current;
    const next = pagination?.next_page || (pagination?.has_next ? current + 1 : null);
    const prev = pagination?.prev_page || (current > 1 ? current - 1 : null);

    paginationState = {
        current,
        total,
        next,
        prev
    };

    if (pageInfo) {
        pageInfo.textContent = `Halaman ${current} dari ${total}`;
    }
}

function showLoadingState(container) {
    container.innerHTML = '<div class="loading">Memuat daftar completed...</div>';
}

function refreshPaginationButtons() {
    const prevBtn = document.getElementById('paginationPrev');
    const nextBtn = document.getElementById('paginationNext');

    if (prevBtn) {
        prevBtn.disabled = isLoading || !paginationState.prev;
    }
    if (nextBtn) {
        nextBtn.disabled = isLoading || !paginationState.next;
    }
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;

    errorContainer.innerHTML = `<div class="error">⚠️ ${escapeHtml(message)}</div>`;
    errorContainer.style.display = 'block';
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (!errorContainer) return;

    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return char;
        }
    });
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!menuToggle || !sidebar) return;

    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
        document.body.classList.add('sidebar-open');
    });

    const closeSidebar = () => {
        sidebar.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';
    };

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', closeSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchInput = document.getElementById('searchInput');
    const searchContainer = document.querySelector('.search-container');

    if (!searchIconBtn || !searchContainer) return;

    searchIconBtn.addEventListener('click', () => {
        searchContainer.classList.add('active');
        if (searchInput) searchInput.focus();
    });

    if (searchCloseBtn) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer.classList.remove('active');
            if (searchInput) {
                searchInput.value = '';
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                searchAnime();
            }
        });
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (query) {
        window.location.href = `/v4/search?q=${encodeURIComponent(query)}`;
    }
}

console.log('[V4] Completed page script loaded');
