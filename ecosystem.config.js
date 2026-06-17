module.exports = {
    apps: [{
        name: 'animme',
        script: 'server/server.js',
        cwd: __dirname,
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '600M',
        env: {
            NODE_ENV: 'production',
            PORT: 5000
        },
        env_development: {
            NODE_ENV: 'development',
            PORT: 5000
        }
    }]
};