// HLS Conversion Service
// Converts remote video URLs directly to HLS and serves with auto-cleanup

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configuration
const HLS_DIR = path.join(__dirname, '../cache/hls');
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout for inactive sessions
const MAX_CONCURRENT_CONVERSIONS = 8; // Allow multiple qualities to convert simultaneously

// Active sessions tracking
const activeSessions = new Map();
const activeConversions = new Set();

// Ensure HLS directory exists
async function ensureHLSDir() {
    try {
        await fs.mkdir(HLS_DIR, { recursive: true });
        console.log('HLS directory ready:', HLS_DIR);
    } catch (error) {
        console.error('Error creating HLS directory:', error);
    }
}

// Generate unique session ID
function generateSessionId(videoUrl, episodeId, quality = 'auto') {
    const hash = crypto.createHash('md5').update(videoUrl + episodeId + quality).digest('hex');
    return `session_${quality}_${hash}_${Date.now()}`;
}

// Generate file hash for caching
function generateFileHash(videoUrl) {
    return crypto.createHash('md5').update(videoUrl).digest('hex');
}

// Convert remote video URL directly to HLS format
async function convertToHLS(videoUrl, outputDir, sessionId) {
    console.log('Converting remote source to HLS:', videoUrl);
    console.log('Output directory:', outputDir);

    return new Promise((resolve, reject) => {
        const outputPlaylist = path.join(outputDir, 'playlist.m3u8');

        ffmpeg(videoUrl)
            .inputOptions([
                '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            ])
            .outputOptions([
                '-codec: copy', // Copy codecs without re-encoding for speed
                '-start_number 0',
                '-hls_time 10', // 10 second segments
                '-hls_list_size 0',
                '-hls_segment_filename', path.join(outputDir, 'segment%03d.ts'),
                '-f hls'
            ])
            .output(outputPlaylist)
            .on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`Conversion progress: ${progress.percent.toFixed(2)}%`);
                }
            })
            .on('end', () => {
                console.log('HLS conversion completed:', outputPlaylist);
                resolve(outputPlaylist);
            })
            .on('error', (error) => {
                console.error('FFmpeg error:', error);
                reject(new Error('Failed to convert video: ' + error.message));
            })
            .run();
    });
}

// Create HLS from video URL
async function createHLS(videoUrl, episodeId, quality = 'auto') {
    const sessionId = generateSessionId(videoUrl, episodeId, quality);
    const fileHash = generateFileHash(videoUrl);

    console.log('\n=== Starting HLS Creation ===');
    console.log('Session ID:', sessionId);
    console.log('Episode ID:', episodeId);
    console.log('Quality:', quality);
    console.log('Video URL:', videoUrl);

    // Check if too many concurrent conversions
    if (activeConversions.size >= MAX_CONCURRENT_CONVERSIONS) {
        throw new Error('Too many concurrent conversions. Please try again later.');
    }

    // Create session directory
    const sessionDir = path.join(HLS_DIR, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    // Mark conversion as active
    activeConversions.add(sessionId);

    try {
        const hlsDir = path.join(sessionDir, 'hls');
        await fs.mkdir(hlsDir, { recursive: true });

        // Step 1: Convert remote source directly to HLS
        console.log(`[${quality}] Step 1: Converting remote source to HLS...`);
        const playlistPath = await convertToHLS(videoUrl, hlsDir, sessionId);

        // Create session tracking
        const session = {
            sessionId,
            episodeId,
            quality,
            playlistUrl: `/api/hls/${sessionId}/playlist.m3u8`,
            createdAt: Date.now(),
            lastAccess: Date.now(),
            hlsDir,
            active: true
        };

        activeSessions.set(sessionId, session);
        activeConversions.delete(sessionId);

        // Start session timeout
        startSessionTimeout(sessionId);

        console.log(`=== HLS Creation Complete [${quality}] ===`);
        console.log(`Playlist URL: ${session.playlistUrl}\n`);

        return session;

    } catch (error) {
        // Cleanup on error
        activeConversions.delete(sessionId);
        await cleanupSession(sessionId).catch(console.error);
        throw error;
    }
}

// Start session timeout
function startSessionTimeout(sessionId) {
    setTimeout(() => {
        const session = activeSessions.get(sessionId);
        if (session && session.active) {
            const inactiveTime = Date.now() - session.lastAccess;
            if (inactiveTime >= SESSION_TIMEOUT) {
                console.log(`Session ${sessionId} timed out`);
                cleanupSession(sessionId);
            } else {
                // Restart timeout if still active
                startSessionTimeout(sessionId);
            }
        }
    }, SESSION_TIMEOUT);
}

// Update session last access time
function updateSessionAccess(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
        session.lastAccess = Date.now();
    }
}

// Cleanup session files
async function cleanupSession(sessionId) {
    console.log('Cleaning up session:', sessionId);

    const session = activeSessions.get(sessionId);
    if (session) {
        session.active = false;

        // Delete session directory
        const sessionDir = path.join(HLS_DIR, sessionId);
        try {
            await fs.rm(sessionDir, { recursive: true, force: true });
            console.log('Session directory deleted:', sessionDir);
        } catch (error) {
            console.error('Error deleting session directory:', error);
        }

        activeSessions.delete(sessionId);
    }
}

// Get session info
function getSession(sessionId) {
    return activeSessions.get(sessionId);
}

// List active sessions
function getActiveSessions() {
    return Array.from(activeSessions.values());
}

// Close session (called by client)
async function closeSession(sessionId) {
    console.log('Closing session:', sessionId);
    await cleanupSession(sessionId);
    return { success: true, message: 'Session closed' };
}

// Auto-cleanup old HLS sessions (older than 1 hour)
async function cleanupOldHLSSessions() {
    try {
        const sessions = Array.from(activeSessions.values());
        const now = Date.now();
        const MAX_AGE = 60 * 60 * 1000; // 1 hour
        let cleanedCount = 0;

        for (const session of sessions) {
            const age = now - session.createdAt;
            if (age > MAX_AGE) {
                console.log(`Cleaning up old HLS session (${session.quality}): ${session.sessionId}`);
                await cleanupSession(session.sessionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 [HLS Cleanup] Cleaned ${cleanedCount} old HLS session(s)`);
        }
    } catch (error) {
        console.error('[HLS Cleanup] Error:', error.message);
    }
}

// Initialize HLS service
async function initialize() {
    await ensureHLSDir();
    console.log('HLS Service initialized');

    // Run cleanup every 10 minutes
    setInterval(cleanupOldHLSSessions, 10 * 60 * 1000);
    console.log('HLS auto-cleanup enabled: Sessions older than 1 hour will be deleted every 10 minutes');

    // Run initial cleanup
    cleanupOldHLSSessions();
}

module.exports = {
    initialize,
    createHLS,
    getSession,
    updateSessionAccess,
    closeSession,
    cleanupSession,
    getActiveSessions
};
