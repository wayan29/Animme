const API_BASE = '/api/v2';

let currentPage = 1;
let paginationData = null;
let selectedServer = localStorage.getItem('selectedServer') || 'v2';

async function fetchAnimeList(page = 1, pagesToLoad = 1) {
    try {
        // Force use V2 API for anime terbaru
        let url = `${API_BASE}/terbaru/${page}`;
        if (pagesToLoad > 1) {
            url += `?pages=${pagesToLoad}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched anime list data:', data);
        return data;
    } catch (error) {
        console.error('Error fetching anime list:', error);
        return null;
    }
}

function displayAnimeList(animeList) {
    const container = document.getElementById('animeListContainer');

    if (!animeList || animeList.length === 0) {
        container.innerHTML = '<div class="error">Tidak ada data anime terbaru</div>';
        return;
    }

    container.innerHTML = `
        <div class="anime-grid">
            ${animeList.map(anime => `
                <div class="anime-card" onclick="goToDetail('${anime.slug}')">
                    <div class="anime-poster">
                        <img src="${anime.poster || 'https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'}"
                             alt="${anime.title}"
                             onerror="this.src='https://via.placeholder.com/200x300/0f0f0f/e50914?text=No+Image'">
                        <div class="anime-overlay">
                            ${anime.current_episode ? `<span class="anime-type">Ep ${anime.current_episode}</span>` : ''}
                            ${anime.status ? `<span class="anime-rating">${anime.status}</span>` : ''}
                        </div>
                    </div>
                    <div class="anime-info">
                        <h3 class="anime-title" title="${anime.title}">${anime.title}</h3>
                        ${anime.current_episode ? `<div class="anime-status">Episode ${anime.current_episode}</div>` : '<div class="anime-status">Ongoing</div>'}
                        ${anime.release_date ? `<div class="anime-status">${anime.release_date}</div>` : ''}
                        <div class="anime-genres">
                            <span class="genre-tag">Terbaru</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function displayPagination(pagination) {
    const container = document.getElementById('paginationContainer');
    
    if (!pagination) {
        container.style.display = 'none';
        return;
    }
    
    paginationData = pagination;
    container.style.display = 'flex';
    
    const maxButtons = 5;
    const currentPage = pagination.current_page;
    const lastPage = pagination.last_page || pagination.total_pages || 675; // fallback to 675
    
    let paginationHTML = '';
    
    // Previous button
    if (pagination.has_previous_page) {
        paginationHTML += `<button class="pagination-btn" onclick="loadPage(${pagination.previous_page})">‹ Prev</button>`;
    } else {
        paginationHTML += `<button class="pagination-btn disabled" disabled>‹ Prev</button>`;
    }
    
    // Calculate page range to display
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(lastPage, startPage + maxButtons - 1);
    
    // Adjust range if at bounds
    if (endPage - startPage + 1 < maxButtons) {
        if (startPage === 1) {
            endPage = Math.min(lastPage, maxButtons);
        } else {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
    }
    
    // First page
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="loadPage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-dots">...</span>`;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="pagination-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="pagination-btn" onclick="loadPage(${i})">${i}</button>`;
        }
    }
    
    // Last page
    if (endPage < lastPage) {
        if (endPage < lastPage - 1) {
            paginationHTML += `<span class="pagination-dots">...</span>`;
        }
        paginationHTML += `<button class="pagination-btn" onclick="loadPage(${lastPage})">${lastPage}</button>`;
    }
    
    // Next button
    if (pagination.has_next_page) {
        paginationHTML += `<button class="pagination-btn" onclick="loadPage(${pagination.next_page})">Next ›</button>`;
    } else {
        paginationHTML += `<button class="pagination-btn disabled" disabled>Next ›</button>`;
    }
    
    // Add page info and wrap buttons
    const itemsPerLoad = pagination.items_per_page || 16;
    const totalItems = pagination.total_items || 'N/A';
    
    paginationHTML = `
        <div class="pagination-info">Page ${currentPage} of ${lastPage} (${lastPage} total pages) • Showing ${itemsPerLoad} items (${totalItems} loaded)</div>
        <div class="pagination-buttons">${paginationHTML}</div>
    `;
    
    container.innerHTML = paginationHTML;
}

async function loadPage(page) {
    currentPage = page;
    
    const container = document.getElementById('animeListContainer');
    container.innerHTML = '<div class="loading">Memuat halaman ' + page + '...</div>';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Get items per page preferences from localStorage or default to 1 page (16 items)
    const itemsPreference = localStorage.getItem('animeListItemsPerPage') || '1';
    const pagesToLoad = parseInt(itemsPreference);
    
    const response = await fetchAnimeList(page, pagesToLoad);
    
    if (response && response.status === 'success' && response.data) {
        // Check if data has pagination structure
        if (response.data.animeData) {
            displayAnimeList(response.data.animeData);
            displayPagination(response.data.paginationData);
            
            // Update current page for navigation based on response
            currentPage = response.data.paginationData.current_page || page;
        } else {
            // Fallback: direct array format
            displayAnimeList(response.data);
            displayPagination(null);
        }
    } else {
        container.innerHTML = '<div class="error">Gagal memuat data anime terbaru</div>';
    }
}

function goToDetail(slug) {
    if (slug) {
        // Use V2 detail endpoint
        window.location.href = `/detail-v2/${slug}`;
    }
}

// Server selector functionality
function changeServer(server) {
    selectedServer = server;
    localStorage.setItem('selectedServer', server);
    applyServerClass();
    
    // Show notification
    showNotification(`Server berubah ke ${server === 'v1' ? 'V1 (Otakudesu)' : 'V2 (Samehadaku)'}`);
}

function applyServerClass() {
    const body = document.body;
    body.classList.remove('server-v1', 'server-v2');
    body.classList.add(`server-${selectedServer}`);
    
    // Update server selector
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = selectedServer;
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide after 2 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Function to search anime (using V2 API)
function searchAnime() {
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
        window.location.href = `/search-v2/${query}`;
    }
}

// Allow Enter key for search
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAnime();
            }
        });
    }
});

async function loadAnimeListPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page')) || 1;
    
    // Load server preference
    const serverFromStorage = localStorage.getItem('selectedServer');
    if (serverFromStorage) {
        selectedServer = serverFromStorage;
        applyServerClass();
    }
    
    await loadPage(page);
}

// Handle items per page change
function onItemsPerPageChange(value) {
    localStorage.setItem('animeListItemsPerPage', value);
    // Reload current page with new preference
    loadPage(currentPage);
}

// Initialize page load
document.addEventListener('DOMContentLoaded', () => {
    loadAnimeListPage();
    
    // Add server selector change event
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.addEventListener('change', (e) => {
            changeServer(e.target.value);
        });
        
        // Apply initial server class
        applyServerClass();
    }
    
    // Add items per page change event
    const itemsPerPage = document.getElementById('itemsPerPage');
    if (itemsPerPage) {
        // Set initial value from localStorage
        const savedPreference = localStorage.getItem('animeListItemsPerPage') || '1';
        itemsPerPage.value = savedPreference;
        
        itemsPerPage.addEventListener('change', (e) => {
            onItemsPerPageChange(e.target.value);
        });
    }
});
