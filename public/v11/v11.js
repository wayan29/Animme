const V11 = (() => {
    const enc = encodeURIComponent;
    const $ = (sel) => document.querySelector(sel);
    function escapeHtml(value = '') {
        return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    }
    function img(src) { return src || 'https://placehold.co/400x600/111/fff?text=Oploverz'; }
    async function api(path) {
        const res = await fetch(path);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.status === 'error') throw new Error(json.message || `HTTP ${res.status}`);
        return json.data || json;
    }
    function card(item = {}) {
        const slug = item.detail_slug || item.series_slug || item.slug || '';
        const isEpisode = item.episode_num && item.series_slug;
        const href = isEpisode ? `/v11/episode?slug=${enc(item.series_slug)}&episode=${enc(item.episode_num)}${item.id ? `&id=${enc(item.id)}` : ''}` : `/v11/detail?slug=${enc(slug)}`;
        return `<a class="card" href="${href}">
            <div class="poster"><img src="${escapeHtml(img(item.poster))}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://placehold.co/400x600/111/fff?text=Oploverz'"></div>
            <div class="card-body"><h3 class="card-title">${escapeHtml(item.series_title || item.title || 'Untitled')}</h3>
            ${isEpisode ? `<span class="pill">Episode ${escapeHtml(item.episode_num)}</span>` : `<span class="pill">${escapeHtml(item.type || item.status || 'Series')}</span>`}${item.score ? `<span class="pill">⭐ ${escapeHtml(item.score)}</span>` : ''}</div>
        </a>`;
    }
    function renderGrid(el, items = []) {
        el.innerHTML = items.length ? items.map(card).join('') : '<div class="loading">Tidak ada data.</div>';
    }
    function params() { return new URLSearchParams(location.search); }
    function bindSearch() {
        const input = $('#searchInput'); const btn = $('#searchBtn');
        const go = () => { const q = input?.value?.trim(); if (q) location.href = `/v11/search?q=${enc(q)}`; };
        btn?.addEventListener('click', go); input?.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
    function shell(active = 'home') {
        const nav = [
            ['home', '/v11/home', '⌂', 'Beranda'],
            ['list', '/v11/anime-list', '≡', 'Daftar Anime'],
            ['oploverz', '/v11/home', '◆', 'Oploverz'],
            ['schedule', '/v11/anime-list?sortBy=releaseDate-desc', '◷', 'Jadwal Rilis'],
            ['contact', 'https://link.oploverz.ac/', '☏', 'Hubungi Kami']
        ];
        const items = nav.map(([id, href, icon, label]) => `<a class="nav-link ${active===id?'active':''}" href="${href}"${href.startsWith('http')?' target="_blank" rel="noopener"':''}><span>${icon}</span><span>${label}</span></a>`).join('');
        const mobileItems = nav.map(([id, href, icon, label]) => `<a class="mobile-nav-link ${active===id?'active':''}" href="${href}"${href.startsWith('http')?' target="_blank" rel="noopener"':''}><span>${icon}</span><small>${label}</small></a>`).join('');
        return `<aside class="sidebar oploverz-sidebar"><div class="sidebar-group-label">Aplikasi</div><nav class="nav-menu">${items}</nav><div class="sidebar-server"><select id="serverSelect" class="server-select"></select></div><p class="muted">plus.oploverz.ltd</p></aside><nav class="v11-mobile-nav">${mobileItems}</nav>`;
    }
    function topbar() { return `<div class="topbar oploverz-topbar"><div class="topbar-links"><a href="/v11/home">Beranda</a><a href="/v11/anime-list">Daftar Anime</a><a href="/v11/anime-list?sortBy=releaseDate-desc">Jadwal Rilis</a></div><a class="topbar-logo" href="/v11/home">OP</a><div class="search-box"><input id="searchInput" class="search-input" placeholder="Cari anime..."><button id="searchBtn" class="btn">Cari</button></div></div>`; }
    return { enc, $, escapeHtml, api, card, renderGrid, params, bindSearch, shell, topbar };
})();
