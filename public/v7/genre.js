// AnimMe V7 - Nekopoi Genre Browse Application
const API_BASE = '/api/v7/nekopoi';

const appState = {
    slug: '',
    page: 1,
    results: [],
    pagination: { currentPage: 1, hasNextPage: false, hasPrevPage: false },
    isLoading: false
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initSidebarToggle();
    initMobileSearch();
    setupServerSelector();
    setupSearchHandler();
    setupPaginationControls();
});

async function initializeApp() {
    const params = new URLSearchParams(window.location.search);
    const slug = String(params.get('slug') || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
    if (!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(slug)) {
        renderError('Genre tidak valid. Pilih genre dari Genre List.');
        return;
    }
    await loadGenre(slug, page);
}

async function loadGenre(slug, page = 1) {
    appState.isLoading = true;
    appState.slug = slug;
    appState.page = page;
    renderLoading();
    updateHero(slug, page);
    try {
        const response = await fetch(`${API_BASE}/genre/${encodeURIComponent(slug)}?page=${page}`);
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success' || !payload.data) throw new Error(payload.message || `HTTP ${response.status}`);
        const { items, currentPage, totalPages, hasNextPage, hasPrevPage, title } = payload.data;
        appState.results = Array.isArray(items) ? items : [];
        appState.pagination = { currentPage: currentPage || page, totalPages: totalPages || currentPage || page, hasNextPage: Boolean(hasNextPage), hasPrevPage: Boolean(hasPrevPage) };
        updateHeroTitle(title || slug, appState.pagination.currentPage);
        renderResults();
        renderPagination();
        syncUrl(slug, appState.pagination.currentPage);
    } catch (error) {
        console.error('[V7] Genre API error:', error);
        renderError(/SafeLine|Chaitin|anti-bot|HTTP 468/i.test(error.message || '') ? 'Nekopoi sedang memblokir request dengan anti-bot. Coba lagi nanti.' : 'Gagal memuat genre Nekopoi.');
    } finally {
        appState.isLoading = false;
    }
}

function updateHero(slug, page) {
    const title = humanize(slug);
    updateHeroTitle(title, page);
}

function updateHeroTitle(titleText, page) {
    const title = document.getElementById('searchTitle');
    const subtitle = document.getElementById('searchSubtitle');
    const kicker = document.getElementById('categoryKicker');
    if (kicker) kicker.textContent = 'V7 · Nekopoi Genre';
    if (title) title.textContent = `🏷️ ${titleText}`;
    if (subtitle) subtitle.textContent = `Update genre ${titleText} dari Nekopoi. Halaman ${page}.`;
    document.title = `${titleText} - AnimMe V7`;
}

function renderLoading() {
    const content = document.getElementById('searchContent');
    if (!content) return;
    content.className = 'search-loading';
    content.innerHTML = '<div class="loading-spinner"></div><p>Memuat genre...</p>';
}

function renderResults() {
    const content = document.getElementById('searchContent');
    if (!content) return;
    if (!appState.results.length) {
        content.className = 'search-empty';
        content.innerHTML = '<h2>Tidak ada item</h2><p>Belum ada item untuk genre ini.</p>';
        return;
    }
    content.className = 'result-grid';
    content.replaceChildren();
    appState.results.forEach(item => content.appendChild(createResultCard(item)));
}

function createResultCard(item) {
    const card = document.createElement('a');
    card.className = 'result-card';
    card.href = item.slug ? `/v7/episode?slug=${encodeURIComponent(item.slug)}` : (item.url || '#');
    if (!item.slug && item.url) { card.target = '_blank'; card.rel = 'noopener'; }
    const poster = item.poster || '/images/placeholder.jpg';
    card.innerHTML = `<div class="result-poster" style="background-image:url('${escapeAttribute(poster)}')"><span class="result-badge">Genre</span></div><div class="result-info"><div class="result-title">${escapeHtml(item.title || 'Judul tidak tersedia')}</div>${item.excerpt ? `<div class="result-desc">${escapeHtml(item.excerpt)}</div>` : ''}</div>`;
    return card;
}

function renderError(message) {
    const content = document.getElementById('searchContent');
    if (!content) return;
    content.className = 'search-error';
    content.innerHTML = `<h2>Gagal memuat</h2><p>${escapeHtml(message)}</p><button class="search-btn" type="button" onclick="loadGenre(appState.slug, appState.page || 1)">Coba Lagi</button>`;
    hidePagination();
}

function setupPaginationControls() {
    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (!appState.isLoading && appState.pagination.hasPrevPage) { loadGenre(appState.slug, Math.max(1, appState.pagination.currentPage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        if (!appState.isLoading && appState.pagination.hasNextPage) { loadGenre(appState.slug, appState.pagination.currentPage + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
    document.getElementById('pageJumpForm')?.addEventListener('submit', (event) => {
        event.preventDefault();
        if (appState.isLoading) return;
        const maxPage = appState.pagination.totalPages || 100;
        const input = document.getElementById('pageJumpInput');
        const page = Math.max(1, Math.min(maxPage, parseInt(input?.value, 10) || 1));
        loadGenre(appState.slug, page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function renderPagination() {
    const controls = document.getElementById('paginationControls');
    const prev = document.getElementById('prevPageBtn');
    const next = document.getElementById('nextPageBtn');
    const info = document.getElementById('pageInfo');
    if (!controls || !prev || !next || !info) return;
    controls.style.display = 'flex';
    prev.disabled = !appState.pagination.hasPrevPage;
    next.disabled = !appState.pagination.hasNextPage;
    const totalPages = appState.pagination.totalPages;
    info.textContent = `Genre · Halaman ${appState.pagination.currentPage}${totalPages ? ` dari ${totalPages}` : ''}`;
    const jumpInput = document.getElementById('pageJumpInput');
    if (jumpInput) {
        jumpInput.value = appState.pagination.currentPage;
        jumpInput.max = totalPages || '';
        jumpInput.placeholder = totalPages ? `1-${totalPages}` : '15';
    }
}
function hidePagination() { const controls = document.getElementById('paginationControls'); if (controls) controls.style.display = 'none'; }
function setupSearchHandler() { const i=document.getElementById('searchInput'), b=document.getElementById('searchBtn'); const s=()=>{const q=i?.value?.trim(); if(q) window.location.href=`/v7/search?q=${encodeURIComponent(q)}`;}; b?.addEventListener('click',s); i?.addEventListener('keypress',e=>{if(e.key==='Enter')s();}); }
function setupServerSelector() { const ss=document.getElementById('serverSelect'); if(!ss)return; ss.addEventListener('change',e=>{const m={v1:'/v1/home',v2:'/v2/home',v3:'/v3/home',v4:'/v4/home',v5:'/v5/home',v6:'/v6/home',v7:'/v7/home',v8:'/v8/home',v9:'/v9/home',v10:'/v10/home'}; if(m[e.target.value]) window.location.href=m[e.target.value];}); }
function initSidebarToggle() { const mt=document.getElementById('menuToggle'), mc=document.getElementById('menuCloseBtn'), sb=document.getElementById('sidebar'), bd=document.getElementById('sidebarBackdrop'), links=document.querySelectorAll('.sidebar-menu .nav-link'); const open=()=>{sb?.classList.add('active');bd?.classList.add('active');document.body.classList.add('sidebar-open');}; const close=()=>{sb?.classList.remove('active');bd?.classList.remove('active');document.body.classList.remove('sidebar-open');}; mt?.addEventListener('click',open); mc?.addEventListener('click',close); bd?.addEventListener('click',close); links.forEach(l=>l.addEventListener('click',close)); document.addEventListener('keydown',e=>{if(e.key==='Escape')close();}); }
function initMobileSearch() { const btn=document.getElementById('searchIconBtn'), box=document.querySelector('.search-container'), close=document.getElementById('searchCloseBtn'), input=document.getElementById('searchInput'); btn?.addEventListener('click',()=>{box?.classList.add('active');setTimeout(()=>input?.focus(),100);}); close?.addEventListener('click',()=>{box?.classList.remove('active'); if(input) input.value='';}); }
function syncUrl(slug,page){const p=new URLSearchParams(); p.set('slug',slug); if(page>1)p.set('page',page); window.history.replaceState({},'',`/v7/genre?${p.toString()}`);}
function humanize(slug){return String(slug||'').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
function escapeHtml(text){const div=document.createElement('div'); div.textContent=text==null?'':String(text); return div.innerHTML;}
function escapeAttribute(text){return escapeHtml(text).replace(/'/g,'&#39;').replace(/"/g,'&quot;');}
