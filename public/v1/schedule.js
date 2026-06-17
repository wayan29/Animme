const API_BASE = '/api';

const DAYS_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'Random'];

async function fetchSchedule() {
    try {
        const response = await fetch(`${API_BASE}/schedule`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return null;
    }
}

function goToDetail(slug) {
    if (slug) {
        window.location.href = `/detail/${slug}`;
    }
}

function createScheduleAnimeItem(anime) {
    const item = document.createElement('div');
    item.className = 'schedule-anime-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');

    const openDetail = () => goToDetail(anime.slug);
    item.addEventListener('click', openDetail);
    item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail();
        }
    });

    const title = document.createElement('div');
    title.className = 'schedule-anime-title';
    title.textContent = anime.title || 'Tanpa judul';

    const arrow = document.createElement('div');
    arrow.className = 'schedule-anime-arrow';
    arrow.textContent = '→';

    item.appendChild(title);
    item.appendChild(arrow);
    return item;
}

function displaySchedule(scheduleData) {
    const container = document.getElementById('scheduleContainer');

    if (!scheduleData || !scheduleData.data) {
        showListError(container, 'Gagal memuat jadwal rilis');
        return;
    }

    const scheduleArray = Object.entries(scheduleData.data).map(([day, animeList]) => ({
        day,
        anime_list: animeList
    }));

    const sortedData = scheduleArray.sort((a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day));

    container.replaceChildren();

    sortedData.forEach((daySchedule) => {
        const section = document.createElement('div');
        section.className = 'schedule-day-section';

        const header = document.createElement('div');
        header.className = 'schedule-day-header';

        const dayTitle = document.createElement('h3');
        dayTitle.className = 'schedule-day-title';
        dayTitle.textContent = daySchedule.day;

        const dayCount = document.createElement('span');
        dayCount.className = 'schedule-day-count';
        const animeCount = daySchedule.anime_list ? daySchedule.anime_list.length : 0;
        dayCount.textContent = `${animeCount} Anime`;

        header.appendChild(dayTitle);
        header.appendChild(dayCount);

        const list = document.createElement('div');
        list.className = 'schedule-anime-list';

        if (daySchedule.anime_list && daySchedule.anime_list.length > 0) {
            daySchedule.anime_list.forEach((anime) => {
                list.appendChild(createScheduleAnimeItem(anime));
            });
        } else {
            const empty = document.createElement('div');
            empty.className = 'no-anime';
            empty.textContent = 'Tidak ada anime';
            list.appendChild(empty);
        }

        section.appendChild(header);
        section.appendChild(list);
        container.appendChild(section);
    });
}

async function loadSchedulePage() {
    const container = document.getElementById('scheduleContainer');
    showListLoading(container, 'Memuat jadwal...');

    const data = await fetchSchedule();
    if (data && data.data) {
        displaySchedule(data);
    } else {
        showListError(container, 'Gagal memuat jadwal rilis', loadSchedulePage);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSchedulePage();
});