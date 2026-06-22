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
        const slug = item.slug || item.series_slug || '';
        return `<a class="card" href="/v11/detail?slug=${enc(slug)}">
            <div class="poster"><img src="${escapeHtml(img(item.poster))}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://placehold.co/400x600/111/fff?text=Oploverz'"></div>
            <div class="card-body"><h3 class="card-title">${escapeHtml(item.title || 'Untitled')}</h3>
            <span class="pill">${escapeHtml(item.type || item.status || 'Series')}</span>${item.score ? `<span class="pill">⭐ ${escapeHtml(item.score)}</span>` : ''}</div>
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
        return `<aside class="sidebar"><a class="logo" href="/v11/home">V11 <span>Oploverz</span></a><select id="serverSelect" class="server-select"></select><nav class="nav-menu">
            <a class="nav-link ${active==='home'?'active':''}" href="/v11/home">🏠 Home</a>
            <a class="nav-link ${active==='list'?'active':''}" href="/v11/anime-list">📚 Anime List</a>
            <a class="nav-link ${active==='search'?'active':''}" href="/v11/search">🔎 Search</a>
        </nav><p class="muted">Source: plus.oploverz.ltd</p></aside>`;
    }
    function topbar() { return `<div class="topbar"><div><strong>Oploverz Plus</strong><div class="muted">Streaming anime subtitle Indonesia</div></div><div class="search-box"><input id="searchInput" class="search-input" placeholder="Cari anime..."><button id="searchBtn" class="btn">Cari</button></div></div>`; }
    return { enc, $, escapeHtml, api, card, renderGrid, params, bindSearch, shell, topbar };
})();
