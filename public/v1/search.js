const V1_API_BASE = '/api';
const V2_API_BASE = '/api/v2';

async function fetchSearchResults(apiBase, keyword) {
    try {
        const response = await fetch(`${apiBase}/search/${encodeURIComponent(keyword)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data?.status === 'error') {
            throw new Error(data.message || 'Search failed');
        }
        return data;
    } catch (error) {
        console.error(`Error fetching search from ${apiBase}:`, error);
        return null;
    }
}

function extractSlugFromUrl(url) {
    if (!url) return '';
    if (!url.startsWith('http')) return url;

    const match = url.match(/\/anime\/([^\/]+)/);
    return match ? match[1] : url;
}

function normalizeGenres(genres) {
    if (!Array.isArray(genres) || genres.length === 0) {
        return 'N/A';
    }

    return genres
        .map((genre) => (typeof genre === 'string' ? genre : genre?.name))
        .filter(Boolean)
        .slice(0, 5)
        .join(', ');
}

function createSearchResultCard(anime, detailBase) {
    const slug = extractSlugFromUrl(anime.slug);
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');

    const openDetail = () => {
        if (slug) {
            window.location.href = `${detailBase}/${slug}`;
        }
    };

    item.addEventListener('click', openDetail);
    item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
        }
    });

    const posterWrap = document.createElement('div');
    posterWrap.className = 'search-result-poster';

    const poster = document.createElement('img');
    poster.src = anime.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image';
    poster.alt = anime.title || 'Anime poster';
    poster.loading = 'lazy';
    poster.decoding = 'async';
    poster.addEventListener('error', () => {
        poster.src = 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image';
    });
    posterWrap.appendChild(poster);

    const info = document.createElement('div');
    info.className = 'search-result-info';

    const title = document.createElement('h3');
    title.className = 'search-result-title';
    title.textContent = anime.title || 'Tanpa judul';
    info.appendChild(title);

    if (anime.japanese_title) {
        const jpTitle = document.createElement('p');
        jpTitle.className = 'search-result-jp-title';
        jpTitle.textContent = anime.japanese_title;
        info.appendChild(jpTitle);
    }

    const meta = document.createElement('div');
    meta.className = 'search-result-meta';
    [
        anime.rating ? `⭐ ${anime.rating}` : '',
        anime.type ? `📺 ${anime.type}` : '',
        anime.status || '',
        anime.episode_count ? `📼 ${anime.episode_count} Eps` : ''
    ].filter(Boolean).forEach((label) => {
        const badge = document.createElement('span');
        badge.className = 'meta-badge';
        badge.textContent = label;
        meta.appendChild(badge);
    });
    if (meta.childElementCount > 0) {
        info.appendChild(meta);
    }

    if (anime.studio) {
        const studio = document.createElement('p');
        studio.className = 'search-result-studio';
        studio.textContent = `Studio: ${anime.studio}`;
        info.appendChild(studio);
    }

    if (anime.release_date) {
        const release = document.createElement('p');
        release.className = 'search-result-date';
        release.textContent = `Rilis: ${anime.release_date}`;
        info.appendChild(release);
    }

    const genres = document.createElement('div');
    genres.className = 'search-result-genres';
    genres.innerHTML = `<strong>Genre:</strong> ${normalizeGenres(anime.genres)}`;
    info.appendChild(genres);

    if (anime.synopsis) {
        const synopsis = document.createElement('p');
        synopsis.className = 'search-result-synopsis';
        synopsis.textContent = anime.synopsis.length > 300
            ? `${anime.synopsis.substring(0, 300)}...`
            : anime.synopsis;
        info.appendChild(synopsis);
    }

    item.appendChild(posterWrap);
    item.appendChild(info);
    return item;
}

function displaySearchResults(results, keyword, options = {}) {
    const container = document.getElementById('searchResultsContainer');
    const searchInfo = document.getElementById('searchInfo');
    const detailBase = options.source === 'v2' ? '/detail-v2' : '/detail';

    container.replaceChildren();

    if (!results || results.length === 0) {
        searchInfo.textContent = `Tidak ditemukan hasil untuk "${keyword}"`;
        searchInfo.style.color = '#999';

        const empty = document.createElement('div');
        empty.className = 'no-results';
        empty.textContent = 'Tidak ada anime yang ditemukan. Coba kata kunci lain.';
        container.appendChild(empty);
        return;
    }

    const sourceLabel = options.source === 'v2' ? 'Samehadaku (V2)' : 'Otakudesu (V1)';
    searchInfo.textContent = `Ditemukan ${results.length} hasil untuk "${keyword}" dari ${sourceLabel}`;
    searchInfo.style.color = '#e50914';

    results.forEach((anime) => {
        container.appendChild(createSearchResultCard(anime, detailBase));
    });
}

function showSearchError(keyword, message) {
    const container = document.getElementById('searchResultsContainer');
    const searchInfo = document.getElementById('searchInfo');

    searchInfo.textContent = 'Gagal melakukan pencarian';
    searchInfo.style.color = '#e50914';

    container.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.className = 'error-state';

    const errorText = document.createElement('p');
    errorText.className = 'error';
    errorText.textContent = message;
    wrapper.appendChild(errorText);

    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'retry-btn';
    retryButton.textContent = 'Coba Lagi';
    retryButton.addEventListener('click', () => {
        if (keyword) {
            document.getElementById('searchKeyword').value = keyword;
            performSearch();
        }
    });
    wrapper.appendChild(retryButton);
    container.appendChild(wrapper);
}

function showSearchWarning(message) {
    const warning = document.getElementById('searchWarning');
    if (warning) {
        warning.textContent = message;
        warning.classList.add('visible');
    }
}

async function performSearch() {
    const keyword = document.getElementById('searchKeyword').value.trim();

    if (!keyword) {
        const searchInfo = document.getElementById('searchInfo');
        searchInfo.textContent = 'Masukkan kata kunci pencarian terlebih dahulu';
        searchInfo.style.color = '#fbbf24';
        return;
    }

    const newUrl = `${window.location.pathname}?q=${encodeURIComponent(keyword)}`;
    window.history.pushState({}, '', newUrl);

    const container = document.getElementById('searchResultsContainer');
    const searchInfo = document.getElementById('searchInfo');

    searchInfo.textContent = 'Mencari di Otakudesu (V1)...';
    searchInfo.style.color = '#999';
    container.innerHTML = '<div class="loading">Mencari anime...</div>';

    let data = await fetchSearchResults(V1_API_BASE, keyword);
    let source = 'v1';
    let usedFallback = false;

    const v1Results = Array.isArray(data?.data) ? data.data : [];
    if (v1Results.length === 0) {
        searchInfo.textContent = 'V1 tidak tersedia. Mencari di Samehadaku (V2)...';
        const v2Data = await fetchSearchResults(V2_API_BASE, keyword);
        const v2Results = Array.isArray(v2Data?.data) ? v2Data.data : [];

        if (v2Results.length > 0) {
            data = v2Data;
            source = 'v2';
            usedFallback = true;
        }
    }

    if (usedFallback) {
        showSearchWarning('Pencarian Otakudesu (V1) gagal atau kosong. Menampilkan hasil dari Samehadaku (V2).');
    } else {
        document.getElementById('searchWarning')?.classList.remove('visible');
    }

    const results = Array.isArray(data?.data) ? data.data : Array.isArray(data?.search_results) ? data.search_results : [];

    if (results.length > 0) {
        displaySearchResults(results, keyword, { source });
        return;
    }

    showSearchError(
        keyword,
        'Pencarian gagal di V1 dan V2. Coba lagi nanti atau gunakan sumber lain seperti V6 AnimeIndo.'
    );
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchKeyword');
    searchInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    const pathParts = window.location.pathname.split('/');
    let keyword = pathParts[2] ? decodeURIComponent(pathParts[2]) : null;

    if (!keyword) {
        const urlParams = new URLSearchParams(window.location.search);
        keyword = urlParams.get('q');
    }

    if (keyword) {
        document.getElementById('searchKeyword').value = keyword;
        performSearch();
    }
});