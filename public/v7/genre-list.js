const API_BASE = '/api/v7/nekopoi';

document.addEventListener('DOMContentLoaded', () => {
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    loadGenres();
});

async function loadGenres() {
    const content = document.getElementById('genreContent');
    const stats = document.getElementById('genreStats');
    try {
        const response = await fetch(`${API_BASE}/genres`);
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success' || !payload.data) {
            throw new Error(payload.message || `HTTP ${response.status}`);
        }
        const genres = Array.isArray(payload.data.genres) ? payload.data.genres : [];
        if (stats) stats.textContent = `${genres.length} genre tersedia. Klik genre untuk melihat daftar update.`;
        if (!content) return;
        content.className = 'genre-grid';
        content.replaceChildren();
        genres.forEach((genre) => {
            const card = document.createElement('a');
            card.className = 'genre-card';
            card.href = `/v7/genre?slug=${encodeURIComponent(genre.slug)}`;
            card.textContent = `# ${genre.name}`;
            content.appendChild(card);
        });
    } catch (error) {
        console.error('[V7] Genre list API error:', error);
        if (stats) stats.textContent = 'Gagal memuat genre.';
        if (content) {
            content.className = 'genre-error';
            content.innerHTML = '<h2>Gagal memuat genre</h2><p>Coba lagi nanti.</p>';
        }
    }
}

function setupSearchHandler() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const performSearch = () => {
        const query = searchInput?.value?.trim();
        if (query) window.location.href = `/v7/search?q=${encodeURIComponent(query)}`;
    };
    searchBtn?.addEventListener('click', performSearch);
    searchInput?.addEventListener('keypress', event => { if (event.key === 'Enter') performSearch(); });
}

function setupServerSelector() {
    const serverSelect = document.getElementById('serverSelect');
    if (!serverSelect) return;
    serverSelect.addEventListener('change', (e) => {
        const versionMap = { v1:'/v1/home', v2:'/v2/home', v3:'/v3/home', v4:'/v4/home', v5:'/v5/home', v6:'/v6/home', v7:'/v7/home', v8:'/v8/home', v9:'/v9/home', v10:'/v10/home' };
        const targetPath = versionMap[e.target.value];
        if (targetPath) window.location.href = targetPath;
    });
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const sidebarLinks = document.querySelectorAll('.sidebar-menu .nav-link');
    const openSidebar = () => { sidebar?.classList.add('active'); backdrop?.classList.add('active'); document.body.classList.add('sidebar-open'); };
    const closeSidebar = () => { sidebar?.classList.remove('active'); backdrop?.classList.remove('active'); document.body.classList.remove('sidebar-open'); };
    menuToggle?.addEventListener('click', openSidebar);
    menuCloseBtn?.addEventListener('click', closeSidebar);
    backdrop?.addEventListener('click', closeSidebar);
    sidebarLinks.forEach(link => link.addEventListener('click', closeSidebar));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeSidebar(); });
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchContainer = document.querySelector('.search-container');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchInput = document.getElementById('searchInput');
    searchIconBtn?.addEventListener('click', () => { searchContainer?.classList.add('active'); setTimeout(() => searchInput?.focus(), 100); });
    searchCloseBtn?.addEventListener('click', () => { searchContainer?.classList.remove('active'); if (searchInput) searchInput.value = ''; });
}
