# AnimMe

AnimMe adalah aplikasi web agregator anime berbasis Node.js/Express dengan beberapa sumber/scraper dan frontend versi terpisah (`v1` sampai `v10`). Aplikasi ini menyajikan halaman home, katalog anime, detail anime, episode/player, proxy gambar, dan beberapa endpoint API untuk kebutuhan frontend.

> Catatan: proyek ini hanya mengagregasi metadata/link dari sumber pihak ketiga. Ketersediaan data bergantung pada struktur website sumber yang dapat berubah sewaktu-waktu.

## Fitur Utama

- Multi-source anime scraper/API:
  - Otakudesu (`v1`)
  - Samehadaku (`v2`)
  - Kuramanime (`v3`)
  - Anichin
  - Anoboy
  - AnimeIndo
  - Nekopoi
  - Kusonime (`v8`)
  - Auratail
  - Vidku (`v10`)
- Frontend statis per versi di folder `public/v*`.
- API Express terpusat di `server/server.js`.
- Proxy gambar via `/img/:hash`.
- Dukungan HLS/proxy stream helper.
- Cache stale untuk beberapa endpoint scraper yang mahal.
- Rate limit API dasar.
- Konfigurasi PM2 via `ecosystem.config.js`.

## Struktur Project

```txt
.
├── public/                 # Frontend statis
│   ├── index.html          # Landing/root page
│   ├── shared/             # Asset/helper frontend bersama
│   ├── v1/ ... v10/        # Frontend per versi/source
├── server/                 # Backend Express + scraper modules
│   ├── server.js           # Entry point utama
│   ├── routes/             # Route modular
│   ├── utils/              # Utility cache/helper
│   ├── kuramanime/         # V3 scraper
│   ├── kusonime/           # V8 scraper
│   ├── vidku/              # V10 scraper
│   └── ...                 # Source scraper lain
├── cache/                  # Runtime cache (tidak perlu commit isi cache)
├── package.json
├── package-lock.json
├── ecosystem.config.js
└── .env.example
```

## Kebutuhan

- Node.js 20+ direkomendasikan.
- npm.
- Chromium/Chrome untuk scraper yang memakai Puppeteer, terutama source yang butuh rendering/browser.
- PM2 opsional untuk production.

## Instalasi

```bash
npm install
cp .env.example .env
```

Sesuaikan `.env` jika diperlukan, terutama path Chromium/Puppeteer.

## Environment Variables

Contoh tersedia di `.env.example`.

| Variable | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `5000` | Port server Express |
| `NODE_ENV` | `development` | Mode aplikasi |
| `PUPPETEER_EXECUTABLE_PATH` | `/snap/bin/chromium` | Path Chromium untuk Puppeteer |
| `KURAMANIME_CHROMIUM_PATH` | - | Alternatif path Chromium untuk Kuramanime |
| `TERTUYUL_API_KEY` | - | Opsional fallback solver Kuramanime |
| `TERTUYUL_PROXY` | - | Opsional proxy solver Kuramanime |
| `HLS_DEBUG_TOKEN` | - | Token debug HLS saat production |
| `KURAMANIME_DETAIL_CACHE_FRESH_MS` | `1800000` | Fresh cache V3 detail |
| `KURAMANIME_DETAIL_CACHE_STALE_MS` | `7200000` | Stale cache V3 detail |
| `KURAMANIME_DETAIL_CACHE_MAX_ENTRIES` | `300` | Maksimum entry cache V3 detail |
| `KUSONIME_HOME_CACHE_FRESH_MS` | `300000` | Fresh cache V8 home |
| `KUSONIME_HOME_CACHE_STALE_MS` | `1800000` | Stale cache V8 home |
| `KUSONIME_HOME_CACHE_MAX_ENTRIES` | `200` | Maksimum entry cache V8 home |
| `KUSONIME_ANIME_LIST_CACHE_FRESH_MS` | `600000` | Fresh cache V8 anime list |
| `KUSONIME_ANIME_LIST_CACHE_STALE_MS` | `3600000` | Stale cache V8 anime list |
| `KUSONIME_ANIME_LIST_CACHE_MAX_ENTRIES` | `300` | Maksimum entry cache V8 anime list |

## Menjalankan Aplikasi

Development/simple run:

```bash
npm start
```

Server akan berjalan di:

```txt
http://localhost:5000
```

Dengan PM2:

```bash
npm run pm2:start
npm run pm2:logs
```

Restart:

```bash
npm run pm2:restart
```

Stop:

```bash
npm run pm2:stop
```

## Endpoint Penting

Health check:

```txt
GET /api/health
```

Beberapa contoh endpoint:

```txt
GET /api/v3/kuramanime/home
GET /api/v3/kuramanime/anime/:animeId/:slug
GET /api/v3/kuramanime/episode/:animeId/:slug/:episodeNum

GET /api/v8/kusonime/home?page=1
GET /api/v8/kusonime/anime-list?page=1&kind=all

GET /api/v10/vidku/home
GET /api/v10/vidku/anime/:slug
GET /api/v10/vidku/episode/:slug
```

Frontend utama:

```txt
/               Landing page
/v1/            Otakudesu UI
/v3/            Kuramanime UI
/v8/            Kusonime UI
/v10/           Vidku UI
```

## Validasi Sebelum Deploy

Minimal jalankan:

```bash
node --check server/server.js
node --check server/kuramanime/helpers.js
node --check server/kuramanime/pages.js
node --check server/vidku/helpers.js
node --check server/vidku/pages.js
node --check public/v10/detail.js
node --check public/v10/episode.js
node --check public/v8/app.js
node --check public/v8/anime-list.js
```

Opsional:

```bash
npm audit --omit=dev --audit-level=moderate
```

## Catatan Commit/GitHub

Yang perlu di-commit untuk program utama:

- `package.json`, `package-lock.json`
- `ecosystem.config.js`
- `.env.example`
- `public/**`
- `server/**`
- `README.md`
- `.gitignore`

Yang tidak perlu di-commit:

- `.env`
- `node_modules/`
- `cache/` runtime
- `logs/`, `*.log`
- folder kerja/testing lokal seperti `.pi/`, `tmp/`, `temp/`, `temp-debug/`

## License

MIT
