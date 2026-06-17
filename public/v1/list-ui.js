const LIST_PLACEHOLDER_POSTER = 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image';

function createPosterImage(anime) {
    const image = document.createElement('img');
    image.src = anime.poster || anime.poster_original || LIST_PLACEHOLDER_POSTER;
    image.alt = anime.title || 'Anime poster';
    image.className = 'anime-poster';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
        if (anime.poster_original && image.src !== anime.poster_original) {
            image.src = anime.poster_original;
            return;
        }
        image.src = LIST_PLACEHOLDER_POSTER;
    });
    return image;
}

function createListAnimeCard(anime, options = {}) {
    const card = document.createElement('div');
    card.className = 'anime-card anime-list-item';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const openDetail = () => {
        if (anime.slug && typeof options.onOpen === 'function') {
            options.onOpen(anime.slug);
        }
    };

    card.addEventListener('click', openDetail);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
        }
    });

    const thumb = document.createElement('div');
    thumb.className = 'anime-thumb';
    thumb.appendChild(createPosterImage(anime));

    const info = document.createElement('div');
    info.className = 'anime-info';

    const title = document.createElement('div');
    title.className = 'anime-title';
    title.textContent = anime.title || 'Tanpa judul';
    title.title = anime.title || '';

    const meta = document.createElement('div');
    meta.className = 'anime-meta';
    meta.textContent = typeof options.buildMeta === 'function'
        ? options.buildMeta(anime)
        : '';

    info.appendChild(title);
    info.appendChild(meta);

    if (anime.release_date) {
        const date = document.createElement('div');
        date.className = 'anime-date';
        date.textContent = `${options.dateLabel || 'Update'}: ${anime.release_date}`;
        info.appendChild(date);
    }

    card.appendChild(thumb);
    card.appendChild(info);
    return card;
}

function showListError(container, message, retryFn = null) {
    if (!container) return;

    container.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.className = 'error-state';

    const text = document.createElement('p');
    text.className = 'error';
    text.textContent = message;
    wrapper.appendChild(text);

    if (typeof retryFn === 'function') {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'retry-btn';
        retryButton.textContent = 'Coba Lagi';
        retryButton.addEventListener('click', retryFn);
        wrapper.appendChild(retryButton);
    }

    container.appendChild(wrapper);
}

function showListLoading(container, message = 'Memuat...') {
    if (!container) return;
    container.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = message;
    container.appendChild(loading);
}

function renderPagination(container, pagination, onPageChange) {
    if (!container) return;

    container.replaceChildren();

    if (!pagination) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    const maxButtons = 5;
    const currentPage = pagination.current_page;
    const lastPage = pagination.last_page || pagination.total_pages || pagination.last_visible_page || 1;

    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(lastPage, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    const buttonsWrap = document.createElement('div');
    buttonsWrap.className = 'pagination-buttons';

    const addButton = (label, page, disabled = false, active = false) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `pagination-btn${active ? ' active' : ''}${disabled ? ' disabled' : ''}`;
        button.textContent = label;
        button.disabled = disabled;
        if (!disabled && !active && typeof page === 'number') {
            button.addEventListener('click', () => onPageChange(page));
        }
        buttonsWrap.appendChild(button);
    };

    if (pagination.has_previous_page) {
        addButton('‹ Prev', pagination.previous_page);
    } else {
        addButton('‹ Prev', null, true);
    }

    if (startPage > 1) {
        addButton('1', 1);
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            buttonsWrap.appendChild(dots);
        }
    }

    for (let page = startPage; page <= endPage; page += 1) {
        addButton(String(page), page, false, page === currentPage);
    }

    if (endPage < lastPage) {
        if (endPage < lastPage - 1) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            buttonsWrap.appendChild(dots);
        }
        addButton(String(lastPage), lastPage);
    }

    if (pagination.has_next_page) {
        addButton('Next ›', pagination.next_page);
    } else {
        addButton('Next ›', null, true);
    }

    container.appendChild(buttonsWrap);
}

function createGridAnimeCard(anime, options = {}) {
    const card = document.createElement('div');
    card.className = 'anime-card-grid';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const openDetail = () => {
        if (anime.slug && typeof options.onOpen === 'function') {
            options.onOpen(anime.slug);
        }
    };

    card.addEventListener('click', openDetail);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
        }
    });

    const imageWrap = document.createElement('div');
    imageWrap.className = 'anime-card-grid-image';
    imageWrap.appendChild(createPosterImage(anime));

    const body = document.createElement('div');
    body.className = 'anime-card-grid-body';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'anime-card-grid-title';
    title.textContent = anime.title || 'Tanpa judul';

    const meta = document.createElement('div');
    meta.className = 'anime-card-grid-meta';
    const episodeSpan = document.createElement('span');
    episodeSpan.textContent = `${anime.episode_count || 'N/A'} Episode`;
    meta.appendChild(episodeSpan);

    if (anime.rating) {
        const rating = document.createElement('span');
        rating.className = 'anime-card-grid-rating';
        rating.textContent = `⭐ ${anime.rating}`;
        meta.appendChild(rating);
    }

    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);
    body.appendChild(titleWrap);

    if (anime.release_date) {
        const footer = document.createElement('div');
        footer.className = 'anime-card-grid-footer';
        footer.textContent = anime.release_date;
        body.appendChild(footer);
    }

    card.appendChild(imageWrap);
    card.appendChild(body);
    return card;
}

function renderGridAnimeList(container, animeList, options = {}) {
    if (!container) return;

    container.replaceChildren();

    if (!animeList || animeList.length === 0) {
        showListError(container, options.emptyMessage || 'Tidak ada data anime');
        return;
    }

    animeList.forEach((anime) => {
        container.appendChild(createGridAnimeCard(anime, options));
    });
}

function renderAnimeList(container, animeList, options = {}) {
    if (!container) return;

    container.replaceChildren();

    if (!animeList || animeList.length === 0) {
        showListError(container, options.emptyMessage || 'Tidak ada data anime');
        return;
    }

    const list = document.createElement('div');
    list.className = 'anime-list';
    animeList.forEach((anime) => {
        list.appendChild(createListAnimeCard(anime, options));
    });
    container.appendChild(list);
}