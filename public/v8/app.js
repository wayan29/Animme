// Kusonime V8 Frontend

const API_BASE = '/api/v8/kusonime';
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image';

function getCurrentPage() {
    const params = new URLSearchParams(window.location.search);
    const page = parseInt(params.get('page'), 10) || 1;
    return page > 0 ? page : 1;
}

function buildPageUrl(page) {
    const safePage = parseInt(page, 10) || 1;
    const params = new URLSearchParams(window.location.search);

    if (safePage > 1) {
        params.set('page', safePage);
    } else {
        params.delete('page');
    }

    const query = params.toString();
    return `/v8/home${query ? `?${query}` : ''}`;
}

function asText(value, fallback = '') {
    if (value === null || value === undefined) {
        return fallback;
    }

    const text = String(value).trim();
    return text || fallback;
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

function safePositiveInt(value, fallback = 1) {
    const number = parseInt(value, 10);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clearElement(element) {
    while (element?.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function createStatusPanel(message, variant = 'error') {
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

    return panel;
}

function renderError(message = 'Gagal memuat data anime') {
    const latestContainer = document.getElementById('latestAnime');
    if (!latestContainer) return;

    clearElement(latestContainer);
    latestContainer.classList.remove('loading');
    latestContainer.setAttribute('aria-busy', 'false');

    const panel = createStatusPanel(message, 'error');
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'status-retry';
    retryButton.textContent = 'Coba Lagi';
    retryButton.addEventListener('click', loadHomePage);
    panel.appendChild(retryButton);
    latestContainer.appendChild(panel);
}

function renderSkeletonCards(container, count = 12) {
    if (!container) return;

    clearElement(container);
    container.classList.remove('loading');
    container.setAttribute('aria-busy', 'true');

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
        const card = document.createElement('div');
        card.className = 'anime-card skeleton-card';
        card.setAttribute('aria-hidden', 'true');

        const thumb = document.createElement('div');
        thumb.className = 'anime-thumb skeleton-thumb';

        const info = document.createElement('div');
        info.className = 'anime-info';

        const title = document.createElement('div');
        title.className = 'skeleton-line title';

        const meta = document.createElement('div');
        meta.className = 'anime-meta';

        const metaOne = document.createElement('span');
        metaOne.className = 'skeleton-line medium';

        const metaTwo = document.createElement('span');
        metaTwo.className = 'skeleton-line short';

        const genres = document.createElement('div');
        genres.className = 'anime-genres';

        const genreOne = document.createElement('span');
        genreOne.className = 'skeleton-line short';

        const genreTwo = document.createElement('span');
        genreTwo.className = 'skeleton-line medium';

        meta.appendChild(metaOne);
        meta.appendChild(metaTwo);
        genres.appendChild(genreOne);
        genres.appendChild(genreTwo);

        info.appendChild(title);
        info.appendChild(meta);
        info.appendChild(genres);

        card.appendChild(thumb);
        card.appendChild(info);
        fragment.appendChild(card);
    }

    container.appendChild(fragment);
}

// Fetch API helper
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

// Load homepage
async function loadHomePage() {
    const latestContainer = document.getElementById('latestAnime');
    const releaseCount = document.getElementById('releaseCount');
    const latestCountBadge = document.getElementById('latestCountBadge');
    const currentPage = getCurrentPage();

    if (!latestContainer) return;

    renderSkeletonCards(latestContainer);

    try {
        const data = await fetchAPI(`/home?page=${encodeURIComponent(currentPage)}`);

        if (!data || !data.data) {
            renderError('Gagal memuat data anime');
            renderPagination(null);
            return;
        }

        const animeList = Array.isArray(data.data.latest_releases) ? data.data.latest_releases : [];
        const pagination = data.data.pagination || null;

        if (releaseCount) {
            releaseCount.textContent = String(animeList.length);
        }

        if (latestCountBadge) {
            latestCountBadge.textContent = `Page ${currentPage} • ${animeList.length} item`;
        }

        clearElement(latestContainer);
        latestContainer.classList.remove('loading');
        latestContainer.setAttribute('aria-busy', 'false');

        if (animeList.length === 0) {
            latestContainer.appendChild(createStatusPanel('Tidak ada anime tersedia di halaman ini', 'empty'));
            renderPagination(pagination);
            return;
        }

        const fragment = document.createDocumentFragment();
        animeList.forEach(anime => fragment.appendChild(createAnimeCard(anime)));
        latestContainer.appendChild(fragment);
        latestContainer.setAttribute('aria-busy', 'false');

        renderPagination(pagination);
    } catch (error) {
        console.error('Error loading homepage:', error);
        renderError('Gagal memuat data anime');
        renderPagination(null);
    }
}

function createAnimeCard(anime = {}) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');

    const slug = asText(anime.slug);
    const title = asText(anime.title, 'Untitled');

    if (slug) {
        card.addEventListener('click', () => goToDetail(slug));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                goToDetail(slug);
            }
        });
    }

    const thumb = document.createElement('div');
    thumb.className = 'anime-thumb';

    const image = document.createElement('img');
    image.src = safeImageUrl(anime.poster);
    image.alt = title;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
        if (image.src !== PLACEHOLDER_IMAGE) {
            image.src = PLACEHOLDER_IMAGE;
        }
    }, { once: true });
    thumb.appendChild(image);

    const info = document.createElement('div');
    info.className = 'anime-info';

    const titleElement = document.createElement('div');
    titleElement.className = 'anime-title';
    titleElement.title = title;
    titleElement.textContent = title;

    const meta = document.createElement('div');
    meta.className = 'anime-meta';
    meta.appendChild(createPill('meta-pill', asText(anime.release_date, 'Unknown')));
    meta.appendChild(createPill('meta-pill', asText(anime.author, 'Admin')));

    const genres = document.createElement('div');
    genres.className = 'anime-genres';
    const genreList = Array.isArray(anime.genres) ? anime.genres.slice(0, 3) : [];

    if (genreList.length > 0) {
        genreList.forEach(genre => genres.appendChild(createPill('genre-tag', asText(genre, 'Batch'))));
    } else {
        genres.appendChild(createPill('genre-tag', 'Batch'));
    }

    info.appendChild(titleElement);
    info.appendChild(meta);
    info.appendChild(genres);

    card.appendChild(thumb);
    card.appendChild(info);

    return card;
}

function createPill(className, text) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
}

function renderPagination(pagination) {
    const container = document.getElementById('paginationContainer');
    const info = document.getElementById('paginationInfo');
    const buttons = document.getElementById('paginationButtons');

    if (!container || !info || !buttons) {
        return;
    }

    clearElement(buttons);

    const currentPage = safePositiveInt(pagination?.current_page, getCurrentPage());
    const lastPage = safePositiveInt(pagination?.last_page, 1);
    const previousPage = safePositiveInt(pagination?.previous_page, currentPage - 1);
    const nextPage = safePositiveInt(pagination?.next_page, currentPage + 1);
    const hasPreviousPage = Boolean(pagination?.has_previous_page) && currentPage > 1;
    const hasNextPage = Boolean(pagination?.has_next_page) && currentPage < lastPage;

    if (!pagination || (!hasPreviousPage && !hasNextPage && lastPage <= 1)) {
        container.style.display = 'none';
        info.textContent = '';
        return;
    }

    container.style.display = '';
    info.textContent = `Halaman ${currentPage} dari ${lastPage}`;

    buttons.appendChild(createPaginationButton('← Sebelumnya', previousPage, { disabled: !hasPreviousPage }));

    const pages = new Set([1, currentPage - 1, currentPage, currentPage + 1, lastPage]);
    const pageNumbers = Array.from(pages)
        .filter(page => page >= 1 && page <= lastPage)
        .sort((a, b) => a - b);

    let previous = 0;
    pageNumbers.forEach(page => {
        if (page - previous > 1) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            buttons.appendChild(dots);
        }

        buttons.appendChild(createPaginationButton(String(page), page, {
            active: page === currentPage,
            disabled: page === currentPage
        }));
        previous = page;
    });

    buttons.appendChild(createPaginationButton('Berikutnya →', nextPage, { disabled: !hasNextPage }));
}

function createPaginationButton(label, page, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pagination-btn${options.active ? ' active' : ''}${options.disabled ? ' disabled' : ''}`;
    button.textContent = label;
    button.disabled = Boolean(options.disabled);

    if (!button.disabled) {
        button.addEventListener('click', () => goToPage(page));
    }

    return button;
}

function goToPage(page) {
    window.location.href = buildPageUrl(page);
}

function scrollToLatest() {
    const latestSection = document.querySelector('.anime-section');
    if (latestSection) {
        latestSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Go to detail page
function goToDetail(slug) {
    const safeSlug = asText(slug);
    if (safeSlug) {
        window.location.href = `/v8/detail.html?slug=${encodeURIComponent(safeSlug)}`;
    }
}

// Search anime
function searchAnime() {
    const searchInput = document.getElementById('searchInput');
    const keyword = asText(searchInput?.value);

    if (!keyword) {
        alert('Masukkan kata kunci pencarian!');
        return;
    }

    window.location.href = `/v8/search.html?q=${encodeURIComponent(keyword)}`;
}

function bindHomeEvents() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const scrollButton = document.getElementById('scrollToLatestButton');

    searchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            searchAnime();
        }
    });

    searchButton?.addEventListener('click', searchAnime);
    scrollButton?.addEventListener('click', scrollToLatest);
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    bindHomeEvents();

    if (
        window.location.pathname.endsWith('index.html') ||
        window.location.pathname === '/v8' ||
        window.location.pathname === '/v8/' ||
        window.location.pathname === '/v8/home'
    ) {
        loadHomePage();
    }
});
