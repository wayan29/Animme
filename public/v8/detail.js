// Kusonime V8 Detail Page

const API_BASE = '/api/v8/kusonime';
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x400/120d08/f59e0b?text=No+Image';

function asText(value, fallback = '') {
    if (value === null || value === undefined) {
        return fallback;
    }
    const text = String(value).trim();
    return text || fallback;
}

function escapeHtml(value) {
    return asText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeImageUrl(value) {
    const raw = asText(value);
    if (!raw) {
        return PLACEHOLDER_IMAGE;
    }
    try {
        const url = new URL(raw, window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : PLACEHOLDER_IMAGE;
    } catch {
        return PLACEHOLDER_IMAGE;
    }
}

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

function getSlugFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return asText(urlParams.get('slug'));
}

function formatSynopsis(synopsis) {
    if (!synopsis) {
        return '';
    }

    return synopsis
        .split(/\n{2,}/)
        .map(text => text.trim())
        .filter(Boolean)
        .map(text => `<p>${escapeHtml(text)}</p>`)
        .join('');
}

function createStatusPanel(message, variant = 'error', options = {}) {
    const panel = document.createElement('div');
    panel.className = `status-panel status-panel--${variant}`;
    panel.setAttribute('role', variant === 'error' ? 'alert' : 'status');

    if (variant === 'loading') {
        const spinner = document.createElement('div');
        spinner.className = 'v8-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        panel.appendChild(spinner);
    } else if (variant === 'error') {
        const icon = document.createElement('span');
        icon.className = 'status-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '⚠️';
        panel.appendChild(icon);
    } else if (variant === 'empty') {
        const icon = document.createElement('span');
        icon.className = 'status-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '📭';
        panel.appendChild(icon);
    }

    const text = document.createElement('p');
    text.className = 'status-message';
    text.textContent = message;
    panel.appendChild(text);

    if (options.retry && typeof options.onRetry === 'function') {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'status-retry';
        retryButton.textContent = 'Coba Lagi';
        retryButton.addEventListener('click', options.onRetry);
        panel.appendChild(retryButton);
    }

    return panel;
}

function renderLoadingSkeleton(container) {
    container.className = 'detail-shell detail-shell--loading';
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = `
        <div class="detail-skeleton" aria-hidden="true">
            <div class="sk-poster"></div>
            <div>
                <div class="sk-line title"></div>
                <div class="sk-line sub"></div>
                <div class="sk-line wide"></div>
                <div class="sk-line wide"></div>
                <div class="sk-line sub"></div>
            </div>
        </div>
        <div class="status-panel status-panel--loading" style="margin-top: 16px;">
            <div class="v8-spinner" aria-hidden="true"></div>
            <p class="status-message">Memuat detail anime...</p>
        </div>
    `;
}

function renderErrorState(container, message) {
    container.className = 'detail-shell';
    container.setAttribute('aria-busy', 'false');
    container.replaceChildren(createStatusPanel(message, 'error', {
        retry: true,
        onRetry: () => loadAnimeDetail()
    }));
}

function buildMetaItem(label, value) {
    const safeValue = asText(value);
    if (!safeValue) {
        return '';
    }
    return `
        <div class="meta-item">
            <span class="meta-label">${escapeHtml(label)}</span>
            <span class="meta-value">${escapeHtml(safeValue)}</span>
        </div>
    `;
}

function buildDownloadSection(anime) {
    const links = anime.download_links;
    const heading = `
        <div class="section-heading">
            <h2 class="section-title">Download batch</h2>
            <span class="section-badge">Sub Indo</span>
        </div>
    `;

    if (!links || Object.keys(links).length === 0) {
        return `
            <div class="download-section">
                ${heading}
                <div class="status-panel status-panel--empty" style="padding: 20px;">
                    <span class="status-icon" aria-hidden="true">📭</span>
                    <p class="status-message">Link download belum tersedia atau gagal diparsing.</p>
                </div>
            </div>
        `;
    }

    let qualitiesHTML = '';
    for (const [quality, hostLinks] of Object.entries(links)) {
        if (!Array.isArray(hostLinks) || hostLinks.length === 0) {
            continue;
        }
        qualitiesHTML += `
            <div class="download-quality">
                <h3>${escapeHtml(quality)}</h3>
                <div class="download-links">
                    ${hostLinks.map(link => `
                        <a href="${escapeHtml(asText(link.url))}" target="_blank" rel="noopener noreferrer" class="download-btn" title="${escapeHtml(asText(link.host))}">
                            ${escapeHtml(asText(link.host))}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }

    return `<div class="download-section">${heading}${qualitiesHTML}</div>`;
}

function buildKicker(anime) {
    const parts = [asText(anime.type), asText(anime.status)].filter(Boolean);
    if (parts.length === 0) {
        return '<span class="detail-kicker">Batch Kusonime</span>';
    }
    return `<span class="detail-kicker">${escapeHtml(parts.join(' · '))}</span>`;
}

function buildGenresHTML(genres) {
    if (!Array.isArray(genres) || genres.length === 0) {
        return '';
    }
    return `<div class="genre-list">${genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}</div>`;
}

function bindPosterFallback(root) {
    root.querySelectorAll('img.detail-poster').forEach(img => {
        img.addEventListener('error', () => {
            if (img.src !== PLACEHOLDER_IMAGE) {
                img.src = PLACEHOLDER_IMAGE;
            }
        }, { once: true });
    });
}

async function loadAnimeDetail() {
    const slug = getSlugFromURL();
    const detailContainer = document.getElementById('detailContent');

    if (!detailContainer) {
        return;
    }

    renderLoadingSkeleton(detailContainer);

    if (!slug) {
        renderErrorState(detailContainer, 'Slug tidak ditemukan di URL.');
        return;
    }

    try {
        const data = await fetchAPI(`/detail/${encodeURIComponent(slug)}`);

        if (!data || !data.data) {
            renderErrorState(detailContainer, 'Gagal memuat detail anime. Periksa koneksi atau coba lagi.');
            return;
        }

        const anime = data.data;
        const posterUrl = escapeHtml(safeImageUrl(anime.poster));
        const title = escapeHtml(asText(anime.title, 'Detail anime'));

        const metaHTML = [
            buildMetaItem('Tipe', anime.type),
            buildMetaItem('Status', anime.status),
            buildMetaItem('Episode', anime.total_episode),
            buildMetaItem('Score', anime.score),
            buildMetaItem('Durasi', anime.duration),
            buildMetaItem('Season', anime.season),
            buildMetaItem('Produser', anime.producer),
            buildMetaItem('Rilis', anime.release_date)
        ].join('');

        detailContainer.className = 'detail-shell is-loaded';
        detailContainer.setAttribute('aria-busy', 'false');
        detailContainer.innerHTML = `
            <div class="detail-header">
                <div class="detail-poster-wrap">
                    <img src="${posterUrl}" alt="Poster ${title}" class="detail-poster" width="300" height="400" decoding="async">
                </div>
                <div class="detail-info">
                    ${buildKicker(anime)}
                    <h1 class="detail-title">${title}</h1>
                    ${anime.japanese_title ? `<p class="detail-subtitle">${escapeHtml(anime.japanese_title)}</p>` : ''}
                    <div class="detail-meta">${metaHTML}</div>
                    ${buildGenresHTML(anime.genres)}
                    ${anime.synopsis ? `
                        <div class="detail-synopsis">
                            <h3>Sinopsis</h3>
                            ${formatSynopsis(anime.synopsis)}
                        </div>
                    ` : ''}
                </div>
            </div>
            ${buildDownloadSection(anime)}
        `;

        bindPosterFallback(detailContainer);
        document.title = `${asText(anime.title, 'Detail')} - Kusonime V8`;

    } catch (error) {
        console.error('Error loading detail:', error);
        renderErrorState(detailContainer, 'Gagal memuat detail anime. Periksa koneksi atau coba lagi.');
    }
}

function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const keyword = asText(searchInput?.value);

    if (!keyword) {
        searchInput?.focus();
        return;
    }

    window.location.href = `/v8/search.html?q=${encodeURIComponent(keyword)}`;
}

function bindPageEvents() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    searchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            searchAnime();
        }
    });

    searchButton?.addEventListener('click', searchAnime);
}

document.addEventListener('DOMContentLoaded', () => {
    bindPageEvents();
    loadAnimeDetail();
});
