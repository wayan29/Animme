// V10 Vidku Detail Page
const API_BASE = '/api/v10/vidku';
let animeData = null;

function escapeHtml(value) {
    if (value == null) return '';

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getEpisodeNumberValue(episode) {
    if (episode?.episode_number == null) return Number.NEGATIVE_INFINITY;

    const parsed = parseFloat(String(episode.episode_number).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function formatListValue(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => typeof item === 'string' ? item : item?.name)
            .filter(Boolean)
            .join(', ');
    }

    return value || '';
}

function formatEpisodeLabel(episodeNumber) {
    if (episodeNumber == null || episodeNumber === '') return 'Episode ?';

    const raw = String(episodeNumber).trim();
    if (!raw) return 'Episode ?';

    return /^ep(isode)?\b/i.test(raw) ? raw : `Episode ${raw}`;
}

function displayValue(value, fallback = '-') {
    if (value == null) return fallback;
    const text = String(value).trim();
    if (!text || text.toLowerCase() === 'n/a') return fallback;
    return text;
}

function getAnimeSlug() {
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('slug');

    if (querySlug) {
        return querySlug;
    }

    const pathMatch = window.location.pathname.match(/\/v10\/detail\/([^/?#]+)/);
    return pathMatch ? decodeURIComponent(pathMatch[1]) : '';
}

function normalizeDetailSlug(slug = '') {
    const value = String(slug || '').trim();
    if (!value) return '';

    return value
        .replace(/-season-\d+-episode-\d+(?:-\d+)?$/i, '')
        .replace(/-episode-\d+(?:-\d+)?$/i, '');
}

document.addEventListener('DOMContentLoaded', () => {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = 'v10';
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
    }

    const slug = getAnimeSlug();
    
    if (slug) {
        loadAnimeDetail(slug);
    } else {
        showError('animeDetail', 'Slug anime tidak ditemukan');
    }

    initMobileSearch();
    initSidebarToggle();
});

function changeServer(server) {
    const slug = getAnimeSlug();
    
    const TARGET_PATHS = {
        v1: `/v1/detail.html?slug=${slug}`,
        v2: `/v2/detail.html?slug=${slug}`,
        v3: `/v3/detail.html?slug=${slug}`,
        v4: `/v4/detail.html?slug=${slug}`,
        v5: `/v5/detail.html?slug=${slug}`,
        v6: `/v6/detail.html?slug=${slug}`,
        v7: `/v7/detail.html?slug=${slug}`,
        v8: `/v8/detail.html?slug=${slug}`,
        v9: `/v9/detail.html?slug=${slug}`,
        v10: `/v10/detail.html?slug=${slug}`
    };

    window.location.href = TARGET_PATHS[server] || `/v1/detail.html?slug=${slug}`;
}

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

async function loadAnimeDetail(slug) {
    console.log('[V10] Loading anime detail:', slug);
    const normalizedSlug = normalizeDetailSlug(slug);
    const data = await fetchAPI(`/anime/${normalizedSlug}`);
    console.log('[V10] Data received:', data);

    if (!data || !data.data) {
        console.error('[V10] No data received from API');
        showError('animeDetail', 'Gagal memuat detail anime');
        return;
    }

    animeData = data.data;
    renderAnimeDetail();
}

function renderAnimeDetail() {
    const container = document.getElementById('animeDetail');
    
    if (!container) return;

    const genresHtml = animeData.genres ? animeData.genres.map(g => 
        `<a href="/v10/all-anime?genre=${encodeURIComponent(g.name)}" class="genre-tag">${escapeHtml(g.name)}</a>`
    ).join('') : '';

    const episodeLists = Array.isArray(animeData.episode_lists)
        ? [...animeData.episode_lists].sort((a, b) => getEpisodeNumberValue(b) - getEpisodeNumberValue(a))
        : [];

    const episodesHtml = episodeLists.map((ep) => {
        const episodeLabel = formatEpisodeLabel(ep.episode_number);
        const episodeTitle = ep.title || episodeLabel;

        return `
            <a href="/v10/episode?slug=${encodeURIComponent(ep.slug || '')}" class="episode-btn v10-episode-btn" title="${escapeHtml(episodeTitle)}">
                ${escapeHtml(episodeTitle)}
            </a>
        `;
    }).join('');

    const firstEpisode = episodeLists.length ? episodeLists[episodeLists.length - 1] : episodeLists[0];
    const latestEpisode = episodeLists[0];

    container.innerHTML = `
        <div class="v10-detail-shell">
            <section class="anime-detail-container">
                <div class="anime-detail-poster">
                    <img src="${animeData.poster || '/placeholder.jpg'}" alt="${escapeHtml(animeData.title || 'Anime poster')}">
                    <div class="anime-detail-rating">
                        <span class="rating-value">${escapeHtml(displayValue(animeData.rating))}</span>
                        <span class="rating-label">Score</span>
                    </div>
                </div>

                <div class="anime-detail-info">
                    <p class="v10-detail-kicker">VIDKU DETAIL</p>
                    <h1 class="anime-detail-title">${escapeHtml(animeData.title || 'Tanpa Judul')}</h1>
                    
                    <div class="anime-detail-meta">
                        ${animeData.type ? `<span class="meta-tag">${escapeHtml(animeData.type)}</span>` : ''}
                        ${animeData.status ? `<span class="meta-tag">${escapeHtml(animeData.status)}</span>` : ''}
                        ${animeData.duration ? `<span class="meta-tag">${escapeHtml(animeData.duration)}</span>` : ''}
                    </div>

                    <div class="v10-detail-quick-strip">
                        ${animeData.studio ? `<span class="v10-quick-chip">${escapeHtml(animeData.studio)}</span>` : ''}
                        ${animeData.premiered ? `<span class="v10-quick-chip">${escapeHtml(animeData.premiered)}</span>` : ''}
                        ${animeData.episode_count ? `<span class="v10-quick-chip">${escapeHtml(animeData.episode_count)} Episode</span>` : ''}
                    </div>

                    ${animeData.japanese_title ? `<p class="anime-detail-studio">Japanese: ${escapeHtml(animeData.japanese_title)}</p>` : ''}
                    ${animeData.studio ? `<p class="anime-detail-studio">Studio: ${escapeHtml(animeData.studio)}</p>` : ''}
                    ${formatListValue(animeData.producers || animeData.producer) ? `<p class="anime-detail-studio">Producer: ${escapeHtml(formatListValue(animeData.producers || animeData.producer))}</p>` : ''}
                    ${animeData.premiered ? `<p class="anime-detail-date">Premiered: ${escapeHtml(animeData.premiered)}</p>` : ''}
                    ${animeData.aired ? `<p class="anime-detail-date">Aired: ${escapeHtml(animeData.aired)}</p>` : ''}
                    ${animeData.rate ? `<p class="anime-detail-date">Rate: ${escapeHtml(animeData.rate)}</p>` : ''}
                    ${animeData.episode_count ? `<p class="anime-detail-episodes">Total Episode: ${escapeHtml(animeData.episode_count)}</p>` : ''}

                    <div class="v10-detail-actions">
                        ${firstEpisode?.slug ? `<a href="/v10/episode?slug=${encodeURIComponent(firstEpisode.slug)}" class="v10-detail-action primary">Mulai Nonton</a>` : ''}
                        ${latestEpisode?.slug ? `<a href="/v10/episode?slug=${encodeURIComponent(latestEpisode.slug)}" class="v10-detail-action secondary">Episode Terbaru</a>` : ''}
                    </div>

                    ${animeData.synopsis ? `
                        <div class="anime-detail-synopsis">
                            <h3>Sinopsis</h3>
                            <p>${escapeHtml(animeData.synopsis)}</p>
                        </div>
                    ` : ''}

                    ${genresHtml ? `
                        <div class="anime-detail-genres">
                            <h3>Genre</h3>
                            <div class="genres-list">${genresHtml}</div>
                        </div>
                    ` : ''}
                </div>
            </section>

            <aside class="v10-detail-side-panel">
                <div class="v10-side-card">
                    <h3 class="v10-side-title">Ringkasan</h3>
                    <div class="v10-side-stats">
                        <div class="v10-side-stat">
                            <span class="label">Score</span>
                            <strong>${escapeHtml(displayValue(animeData.rating))}</strong>
                        </div>
                        <div class="v10-side-stat">
                            <span class="label">Rate</span>
                            <strong>${escapeHtml(animeData.rate || '-')}</strong>
                        </div>
                        <div class="v10-side-stat">
                            <span class="label">Status</span>
                            <strong>${escapeHtml(animeData.status || '-')}</strong>
                        </div>
                        <div class="v10-side-stat">
                            <span class="label">Durasi</span>
                            <strong>${escapeHtml(animeData.duration || '-')}</strong>
                        </div>
                        <div class="v10-side-stat">
                            <span class="label">Episode</span>
                            <strong>${escapeHtml(animeData.episode_count || '-')}</strong>
                        </div>
                        <div class="v10-side-stat">
                            <span class="label">Premiered</span>
                            <strong>${escapeHtml(animeData.premiered || animeData.release_date || '-')}</strong>
                        </div>
                        <div class="v10-side-stat">
                            <span class="label">Aired</span>
                            <strong>${escapeHtml(animeData.aired || '-')}</strong>
                        </div>
                        <div class="v10-side-stat">
                            <span class="label">Studio</span>
                            <strong>${escapeHtml(animeData.studio || '-')}</strong>
                        </div>
                        <div class="v10-side-stat">
                            <span class="label">Producer</span>
                            <strong>${escapeHtml(formatListValue(animeData.producers || animeData.producer) || '-')}</strong>
                        </div>
                    </div>
                </div>
            </aside>
        </div>

        ${episodesHtml ? `
            <div class="episodes-section episode-section">
                <h3 class="section-title">📺 Daftar Episode (${episodeLists.length})</h3>
                <div class="v10-episodes-grid">
                    ${episodesHtml}
                </div>
            </div>
        ` : ''}
    `;
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="error">${message}</div>`;
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput ? searchInput.value.trim() : '';
    
    if (keyword) {
        window.location.href = `/v10/search?q=${encodeURIComponent(keyword)}`;
    }
}

function initMobileSearch() {
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchContainer = document.querySelector('.search-container');

    if (searchIconBtn && searchContainer) {
        searchIconBtn.addEventListener('click', () => {
            searchContainer.classList.add('active');
        });
    }

    if (searchCloseBtn && searchContainer) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer.classList.remove('active');
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAnime();
            }
        });
    }
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            if (backdrop) backdrop.classList.add('active');
        });
    }

    if (menuCloseBtn && sidebar) {
        menuCloseBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
        });
    }

    if (backdrop && sidebar) {
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('active');
            backdrop.classList.remove('active');
        });
    }
}
