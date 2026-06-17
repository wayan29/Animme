const path = require('path');

function registerHlsRoutes(app, hlsService) {
    app.post('/api/hls/convert', async (req, res) => {
        try {
            const { videoUrl, episodeId, quality } = req.body;

            if (!videoUrl || !episodeId) {
                return res.status(400).json({
                    status: 'error',
                    message: 'videoUrl and episodeId are required'
                });
            }

            console.log('HLS Conversion Request:', { videoUrl, episodeId, quality: quality || 'auto' });

            const session = await hlsService.createHLS(videoUrl, episodeId, quality);

            res.json({
                status: 'success',
                message: 'HLS conversion started',
                data: {
                    sessionId: session.sessionId,
                    playlistUrl: session.playlistUrl,
                    createdAt: session.createdAt
                }
            });
        } catch (error) {
            console.error('HLS Conversion Error:', error);
            res.status(500).json({
                status: 'error',
                message: error.message || 'Failed to convert video to HLS'
            });
        }
    });

    app.get('/api/hls/:sessionId/playlist.m3u8', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const session = hlsService.getSession(sessionId);

            if (!session) {
                return res.status(404).send('Session not found');
            }

            hlsService.updateSessionAccess(sessionId);

            const playlistPath = path.join(session.hlsDir, 'playlist.m3u8');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache');
            res.sendFile(playlistPath);
        } catch (error) {
            console.error('Error serving playlist:', error);
            res.status(500).send('Error serving playlist');
        }
    });

    app.get('/api/hls/:sessionId/:segment', async (req, res) => {
        try {
            const { sessionId, segment } = req.params;
            const session = hlsService.getSession(sessionId);

            if (!session) {
                return res.status(404).send('Session not found');
            }

            hlsService.updateSessionAccess(sessionId);

            const hlsDir = path.resolve(session.hlsDir);
            const segmentPath = path.resolve(hlsDir, segment);
            if (!segmentPath.startsWith(`${hlsDir}${path.sep}`)) {
                return res.status(400).send('Invalid segment');
            }

            res.setHeader('Content-Type', 'video/MP2T');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.sendFile(segmentPath);
        } catch (error) {
            console.error('Error serving segment:', error);
            res.status(500).send('Error serving segment');
        }
    });

    app.post('/api/hls/close/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const result = await hlsService.closeSession(sessionId);

            res.json({
                status: 'success',
                message: result.message
            });
        } catch (error) {
            console.error('Error closing session:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to close session'
            });
        }
    });

    app.get('/api/hls/sessions', (req, res) => {
        if (process.env.NODE_ENV === 'production' && req.query.token !== process.env.HLS_DEBUG_TOKEN) {
            return res.status(404).send('Not found');
        }

        const sessions = hlsService.getActiveSessions();
        res.json({
            status: 'success',
            data: {
                count: sessions.length,
                sessions: sessions.map((session) => ({
                    sessionId: session.sessionId,
                    episodeId: session.episodeId,
                    active: session.active,
                    createdAt: new Date(session.createdAt).toISOString(),
                    lastAccess: new Date(session.lastAccess).toISOString()
                }))
            }
        });
    });
}

module.exports = {
    registerHlsRoutes
};
