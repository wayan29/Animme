const SCHEDULE_API = '/api/v10/vidku/schedule';
const DAY_ORDER = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
const DAY_LABELS = {
    senin: 'Senin',
    selasa: 'Selasa',
    rabu: 'Rabu',
    kamis: 'Kamis',
    jumat: 'Jumat',
    sabtu: 'Sabtu',
    minggu: 'Minggu'
};
const DAY_SHORT_LABELS = {
    senin: 'Sen',
    selasa: 'Sel',
    rabu: 'Rab',
    kamis: 'Kam',
    jumat: 'Jum',
    sabtu: 'Sab',
    minggu: 'Min'
};

let scheduleData = {};
let activeDay = getCurrentDayName();

document.addEventListener('DOMContentLoaded', () => {
    initServerSelect();
    initSidebarToggle();
    initSearchUi();
    initNavState();
    loadSchedule();
});

function changeServer(server) {
    localStorage.setItem('selectedServer', server);

    const targetPaths = {
        v1: '/v1/home',
        v2: '/v2/home',
        v3: '/v3/home',
        v4: '/v4/home',
        v5: '/v5/home',
        v6: '/v6/home',
        v7: '/v7/home',
        v8: '/v8/home',
        v9: '/v9/home',
        v10: '/v10/'
    };

    window.location.href = targetPaths[server] || '/v1/home';
}

function initServerSelect() {
    const serverSelect = document.getElementById('serverSelect');
    if (!serverSelect) return;

    serverSelect.value = 'v10';
    serverSelect.addEventListener('change', (event) => changeServer(event.target.value));
}

function initSidebarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const menuCloseBtn = document.getElementById('menuCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            document.body.classList.add('sidebar-open');
            sidebar.classList.add('active');
            if (backdrop) backdrop.classList.add('active');
        });
    }

    if (menuCloseBtn) {
        menuCloseBtn.addEventListener('click', closeSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    document.body.classList.remove('sidebar-open');
    if (sidebar) sidebar.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
}

function initSearchUi() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const searchIconBtn = document.getElementById('searchIconBtn');
    const searchCloseBtn = document.getElementById('searchCloseBtn');
    const searchContainer = document.querySelector('.search-container');

    if (searchBtn) {
        searchBtn.addEventListener('click', executeSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                executeSearch();
            }
        });
    }

    if (searchIconBtn && searchContainer) {
        searchIconBtn.addEventListener('click', () => searchContainer.classList.add('active'));
    }

    if (searchCloseBtn && searchContainer) {
        searchCloseBtn.addEventListener('click', () => searchContainer.classList.remove('active'));
    }
}

function executeSearch() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput ? searchInput.value.trim() : '';

    if (!keyword) {
        window.location.href = '/v10/search';
        return;
    }

    window.location.href = `/v10/search?q=${encodeURIComponent(keyword)}`;
}

function initNavState() {
    document.querySelectorAll('.sidebar .nav-link').forEach((link) => {
        const href = new URL(link.href, window.location.origin);
        link.classList.toggle('active', href.pathname === window.location.pathname);
    });
}

async function loadSchedule() {
    const response = await fetchJson(SCHEDULE_API);
    if (!response || response.status !== 'success') {
        renderEmptyState('Gagal memuat jadwal tayang.');
        return;
    }

    scheduleData = response.data || {};

    if (!scheduleData[activeDay]) {
        activeDay = DAY_ORDER.find((day) => Array.isArray(scheduleData[day]) && scheduleData[day].length > 0) || DAY_ORDER[0];
    }

    renderDayTabs();
    updateWeekTotal();
    renderScheduleCards();
}

function renderDayTabs() {
    const dayTabs = document.getElementById('dayTabs');
    if (!dayTabs) return;

    const today = getCurrentDayName();
    dayTabs.innerHTML = DAY_ORDER.map((day) => {
        const count = (scheduleData[day] || []).length;
        const activeClass = day === activeDay ? ' active' : '';
        const todayClass = day === today ? ' is-today' : '';
        const emptyClass = count ? '' : ' is-empty';
        return `
            <button class="schedule-tab${activeClass}${todayClass}${emptyClass}" type="button" onclick="selectScheduleDay('${day}')" aria-selected="${day === activeDay}">
                <span class="tab-day">
                    <span class="tab-long">${DAY_LABELS[day]}</span>
                    <span class="tab-short">${DAY_SHORT_LABELS[day]}</span>
                </span>
                <span class="tab-count">${count ? `${count} anime` : 'Kosong'}</span>
            </button>
        `;
    }).join('');

    const activeTab = dayTabs.querySelector('.schedule-tab.active');
    if (activeTab && typeof activeTab.scrollIntoView === 'function') {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

function renderScheduleCards() {
    const container = document.getElementById('scheduleContainer');
    const activeDayLabel = document.getElementById('activeDayLabel');
    const resultCount = document.getElementById('resultCount');
    const sectionDayLabel = document.getElementById('sectionDayLabel');
    const sectionBadge = document.getElementById('sectionBadge');

    if (!container) return;

    const items = sortScheduleItems(scheduleData[activeDay] || []);
    if (activeDayLabel) activeDayLabel.textContent = DAY_LABELS[activeDay] || '-';
    if (resultCount) resultCount.textContent = String(items.length);
    if (sectionDayLabel) sectionDayLabel.textContent = DAY_LABELS[activeDay] || '-';
    if (sectionBadge) sectionBadge.textContent = `${items.length} anime`;
    document.title = `AnimMe V10 - Jadwal ${DAY_LABELS[activeDay] || 'Tayang'}`;

    if (items.length === 0) {
        renderEmptyState(`Tidak ada jadwal tayang untuk hari ${DAY_LABELS[activeDay] || activeDay}.`);
        return;
    }

    container.innerHTML = items.map((item) => {
        const target = getScheduleTarget(item);
        const time = item.scheduled_time || item.episode_date || 'TBA';
        return `
            <article class="schedule-card" onclick="window.location.href='${target}'">
                <div class="schedule-poster">
                    <img src="${escapeHtml(item.poster || '/placeholder.jpg')}" alt="${escapeHtml(item.title || 'Anime')}" loading="lazy">
                </div>
                <div class="schedule-info">
                    <h3 class="schedule-title">${escapeHtml(item.title || 'Tanpa Judul')}</h3>
                    <div class="schedule-meta">
                        <span class="schedule-pill time">${escapeHtml(time)}</span>
                        ${item.episode_number ? `<span class="schedule-pill">Ep ${escapeHtml(String(item.episode_number))}</span>` : ''}
                        ${item.type ? `<span class="schedule-pill">${escapeHtml(item.type)}</span>` : ''}
                        ${item.score ? `<span class="schedule-pill score">${escapeHtml(item.score)}</span>` : ''}
                    </div>
                    <span class="schedule-link">Buka halaman anime</span>
                </div>
            </article>
        `;
    }).join('');
}

function renderEmptyState(message) {
    const container = document.getElementById('scheduleContainer');
    if (!container) return;
    container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function updateWeekTotal() {
    const weekTotalCount = document.getElementById('weekTotalCount');
    if (!weekTotalCount) return;

    const total = DAY_ORDER.reduce((sum, day) => sum + (Array.isArray(scheduleData[day]) ? scheduleData[day].length : 0), 0);
    weekTotalCount.textContent = String(total);
}

function sortScheduleItems(items) {
    return [...items].sort((a, b) => getScheduleTimeValue(a) - getScheduleTimeValue(b));
}

function getScheduleTimeValue(item) {
    const value = String(item?.scheduled_time || item?.episode_date || '').match(/(\d{1,2})[:.](\d{2})/);
    if (!value) return Number.MAX_SAFE_INTEGER;
    return (Number(value[1]) * 60) + Number(value[2]);
}

function getScheduleTarget(item) {
    const episodeSlug = extractSlugFromUrl(item.episode_url);
    if (episodeSlug) {
        return `/v10/episode?slug=${encodeURIComponent(episodeSlug)}`;
    }

    if (item.slug) {
        return `/v10/detail?slug=${encodeURIComponent(item.slug)}`;
    }

    return '/v10/';
}

function extractSlugFromUrl(url) {
    if (!url) return '';
    const cleanUrl = String(url).replace(/\/+$/, '');
    const segments = cleanUrl.split('/');
    return segments[segments.length - 1] || '';
}

function getCurrentDayName() {
    const date = new Date();
    const index = date.getDay();
    const map = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    return map[index] || 'senin';
}

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[V10] Schedule request failed:', error);
        return null;
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.selectScheduleDay = (day) => {
    activeDay = day;
    renderDayTabs();
    renderScheduleCards();
};
