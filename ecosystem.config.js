module.exports = {
  apps: [{
    name: 'social-media-poster',
    script: 'backend/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOST: '0.0.0.0',
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_NAME: 'social_media_poster',
      DB_USER: 'postgres',
      DB_PASSWORD: 'postgres',
      JWT_SECRET: 'prod-jwt-secret-key-change-in-real-production-2024',
      JWT_REFRESH_SECRET: 'prod-refresh-secret-key-change-in-real-production-2024',
      JWT_EXPIRE: '15m',
      JWT_REFRESH_EXPIRE: '7d',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
      REDIS_DB: 0
    },
    // Logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Performance settings
    max_memory_restart: '512M',
    node_args: '--max_old_space_size=512',
    
    // Restart settings
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // Environment specific settings
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    
    // Advanced PM2 settings
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Kill timeout
    kill_timeout: 5000,
  }],

  deploy: {
    production: {
      user: 'root',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/social-media-poster.git',
      path: '/root/social-media-poster',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};