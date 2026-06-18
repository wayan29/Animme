const path = require('path');

function registerHtmlRoute(app, routePath, filePath) {
    app.get(routePath, (req, res) => {
        res.sendFile(filePath);
    });
}

function registerHtmlAliases(app, routePath, fileName, version = 'v1') {
    const filePath = path.join(__dirname, `../../../public/${version}/${fileName}.html`);
    registerHtmlRoute(app, `/${routePath}`, filePath);
    registerHtmlRoute(app, `/${routePath}.html`, filePath);
}

function registerPages(app) {
    registerHtmlRoute(app, '/docs', path.join(__dirname, '../../../public/shared/api-docs.html'));
    registerHtmlRoute(app, '/admin/player', path.join(__dirname, '../../../public/admin/player.html'));

    registerHtmlRoute(app, '/v1/home', path.join(__dirname, '../../../public/v1/index.html'));
    registerHtmlRoute(app, '/v2/home', path.join(__dirname, '../../../public/v1/index.html'));

    registerHtmlRoute(app, '/v3', path.join(__dirname, '../../../public/v3/index.html'));
    registerHtmlRoute(app, '/v3/home', path.join(__dirname, '../../../public/v3/index.html'));
    registerHtmlRoute(app, '/v3/detail/:animeId/:slug', path.join(__dirname, '../../../public/v3/detail.html'));
    registerHtmlRoute(app, '/v3/:animeId(\\d+)/:slug', path.join(__dirname, '../../../public/v3/detail.html'));
    registerHtmlRoute(app, '/v3/search', path.join(__dirname, '../../../public/v3/search.html'));
    registerHtmlRoute(app, '/v3/seasons', path.join(__dirname, '../../../public/v3/seasons.html'));
    registerHtmlRoute(app, '/v3/season/:slug', path.join(__dirname, '../../../public/v3/season.html'));
    registerHtmlRoute(app, '/v3/genres', path.join(__dirname, '../../../public/v3/genres.html'));
    registerHtmlRoute(app, '/v3/genre', path.join(__dirname, '../../../public/v3/genre.html'));
    registerHtmlRoute(app, '/v3/genre/:slug', path.join(__dirname, '../../../public/v3/genre.html'));

    registerHtmlRoute(app, '/v4/home', path.join(__dirname, '../../../public/v4/index.html'));
    registerHtmlRoute(app, '/v5/home', path.join(__dirname, '../../../public/v5/index.html'));
    registerHtmlRoute(app, '/v6/home', path.join(__dirname, '../../../public/v6/index.html'));
    registerHtmlRoute(app, '/v7/home', path.join(__dirname, '../../../public/v7/maintenance.html'));

    registerHtmlRoute(app, '/v8', path.join(__dirname, '../../../public/v8/index.html'));
    registerHtmlRoute(app, '/v8/home', path.join(__dirname, '../../../public/v8/index.html'));
    registerHtmlRoute(app, '/v8/anime-list', path.join(__dirname, '../../../public/v8/anime-list.html'));
    registerHtmlRoute(app, '/v8/genres', path.join(__dirname, '../../../public/v8/genres.html'));
    registerHtmlRoute(app, '/v8/years', path.join(__dirname, '../../../public/v8/years.html'));
    registerHtmlRoute(app, '/v8/search', path.join(__dirname, '../../../public/v8/search.html'));

    registerHtmlRoute(app, '/v9', path.join(__dirname, '../../../public/v9/index.html'));
    registerHtmlRoute(app, '/v9/home', path.join(__dirname, '../../../public/v9/index.html'));
    registerHtmlRoute(app, '/v9/completed', path.join(__dirname, '../../../public/v9/completed.html'));
    registerHtmlRoute(app, '/v9/ongoing', path.join(__dirname, '../../../public/v9/completed.html'));
    registerHtmlRoute(app, '/v9/popular', path.join(__dirname, '../../../public/v9/completed.html'));
    registerHtmlRoute(app, '/v9/detail', path.join(__dirname, '../../../public/v9/detail.html'));
    registerHtmlRoute(app, '/v9/episode', path.join(__dirname, '../../../public/v9/episode.html'));

    registerHtmlRoute(app, '/v10', path.join(__dirname, '../../../public/v10/index.html'));
    registerHtmlRoute(app, '/v10/home', path.join(__dirname, '../../../public/v10/index.html'));
    registerHtmlRoute(app, '/v10/detail', path.join(__dirname, '../../../public/v10/detail.html'));
    registerHtmlRoute(app, '/v10/detail/:slug([^.]+)', path.join(__dirname, '../../../public/v10/detail.html'));
    registerHtmlRoute(app, '/v10/episode', path.join(__dirname, '../../../public/v10/episode.html'));
    registerHtmlRoute(app, '/v10/episode/:slug([^.]+)', path.join(__dirname, '../../../public/v10/episode.html'));
    registerHtmlRoute(app, '/v10/anime-list', path.join(__dirname, '../../../public/v10/anime-list.html'));
    registerHtmlRoute(app, '/v10/schedule', path.join(__dirname, '../../../public/v10/schedule.html'));
    registerHtmlRoute(app, '/v10/all-anime', path.join(__dirname, '../../../public/v10/all-anime.html'));
    registerHtmlRoute(app, '/v10/search', path.join(__dirname, '../../../public/v10/search.html'));
    registerHtmlRoute(app, '/v10/airing', path.join(__dirname, '../../../public/v10/all-anime.html'));
    registerHtmlRoute(app, '/v10/az-list', path.join(__dirname, '../../../public/v10/all-anime.html'));
    registerHtmlRoute(app, '/v10/advanced-search', path.join(__dirname, '../../../public/v10/all-anime.html'));
    registerHtmlRoute(app, '/v10/tv-show', path.join(__dirname, '../../../public/v10/all-anime.html'));
    registerHtmlRoute(app, '/v10/movie', path.join(__dirname, '../../../public/v10/all-anime.html'));


    registerHtmlRoute(app, '/detail/:slug([^.]+)', path.join(__dirname, '../../../public/v1/detail.html'));
    registerHtmlRoute(app, '/detail-v2/:slug([a-zA-Z0-9_-]+)', path.join(__dirname, '../../../public/v2/detail.html'));
    registerHtmlRoute(app, '/search-v2/:keyword([a-zA-Z0-9_-]+)', path.join(__dirname, '../../../public/v2/search.html'));
    registerHtmlRoute(app, '/genre-v2/:slug([a-zA-Z0-9_-]+)', path.join(__dirname, '../../../public/v2/genre.html'));
    registerHtmlRoute(app, '/player-v2/:slug([a-zA-Z0-9_-]+)', path.join(__dirname, '../../../public/v2/player.html'));
    registerHtmlRoute(app, '/player/:episode([^.]+)', path.join(__dirname, '../../../public/v1/player.html'));
    registerHtmlRoute(app, '/v1/player', path.join(__dirname, '../../../public/v1/player.html'));
    registerHtmlRoute(app, '/v1/player/:episode([^.]+)', path.join(__dirname, '../../../public/v1/player.html'));
    registerHtmlRoute(app, '/batch/:slug([^.]+)', path.join(__dirname, '../../../public/v1/batch.html'));
    registerHtmlRoute(app, '/genre/:slug([^.]+)', path.join(__dirname, '../../../public/v1/genre.html'));
    registerHtmlRoute(app, '/search/:keyword([^.]+)', path.join(__dirname, '../../../public/v1/search.html'));

    registerHtmlAliases(app, 'schedule', 'schedule', 'v1');
    registerHtmlAliases(app, 'completed', 'completed', 'v1');
    registerHtmlAliases(app, 'ongoing', 'ongoing', 'v1');
    registerHtmlAliases(app, 'genres', 'genres', 'v1');
    registerHtmlAliases(app, 'all-anime', 'all-anime', 'v1');

    const v3StaticRoutes = {
        'v3/animelist': 'anime-list',
        'v3/ongoing': 'ongoing',
        'v3/finished': 'finished',
        'v3/movie': 'movie',
        'v3/schedule': 'schedule',
        'v3/properties': 'properties',
        'v3/studios': 'studios',
        'v3/studio': 'studio',
        'v3/types': 'types',
        'v3/type': 'type',
        'v3/qualities': 'qualities',
        'v3/quality': 'quality',
        'v3/sources': 'sources',
        'v3/source': 'source',
        'v3/countries': 'countries',
        'v3/country': 'country',
        'v3/episode': 'episode',
        'v3/detail': 'detail'
    };

    Object.entries(v3StaticRoutes).forEach(([route, file]) => {
        registerHtmlAliases(app, route, file, 'v3');
    });

    const v4StaticRoutes = {
        'v4/home': 'index',
        'v4/detail': 'detail',
        'v4/episode': 'episode',
        'v4/completed': 'completed'
    };
    Object.entries(v4StaticRoutes).forEach(([route, file]) => {
        registerHtmlAliases(app, route, file, 'v4');
    });

    const v5StaticRoutes = {
        'v5/home': 'index',
        'v5/detail': 'detail',
        'v5/episode': 'episode',
        'v5/search': 'search',
        'v5/azlist': 'azlist',
        'v5/anime-list': 'azlist',
        'v5/latest': 'latest',
        'v5/latest-release': 'latest'
    };
    Object.entries(v5StaticRoutes).forEach(([route, file]) => {
        registerHtmlAliases(app, route, file, 'v5');
    });

    const v6StaticRoutes = {
        'v6/home': 'index',
        'v6/anime-list': 'anime-list',
        'v6/detail': 'detail',
        'v6/episode': 'episode',
        'v6/genres': 'genres',
        'v6/movies': 'movies',
        'v6/genre': 'genre',
        'v6/search': 'search'
    };
    Object.entries(v6StaticRoutes).forEach(([route, file]) => {
        registerHtmlAliases(app, route, file, 'v6');
    });

    const v7StaticRoutes = {
        'v7/home': 'maintenance',
        'v7/detail': 'maintenance',
        'v7/episode': 'maintenance',
        'v7/search': 'maintenance',
        'v7/list': 'maintenance'
    };
    Object.entries(v7StaticRoutes).forEach(([route, file]) => {
        registerHtmlAliases(app, route, file, 'v7');
    });

    registerHtmlRoute(app, '/anime-terbaru', path.join(__dirname, '../../../public/v1/anime-list.html'));
    registerHtmlRoute(app, '/anime-terbaru.html', path.join(__dirname, '../../../public/v1/anime-list.html'));
}

module.exports = {
    registerPages
};
