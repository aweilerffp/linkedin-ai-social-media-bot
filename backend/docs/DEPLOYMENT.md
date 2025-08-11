# 🚀 Deployment Guide

This guide covers deployment options for the Social Media Poster application, from development to production environments.

## 📋 Pre-Deployment Checklist

### Environment Requirements

- **Node.js**: 18.x or later
- **PostgreSQL**: 13.x or later
- **Redis**: 6.x or later
- **Memory**: Minimum 2GB RAM (4GB+ recommended for production)
- **Storage**: 20GB+ for application and logs
- **SSL Certificate**: Required for production (Let's Encrypt recommended)

### Security Checklist

- [ ] All environment variables are properly configured
- [ ] JWT secrets are cryptographically secure (32+ characters)
- [ ] Database credentials are secure and rotated
- [ ] OAuth credentials are configured for production domains
- [ ] Rate limiting is properly configured
- [ ] CORS settings are restrictive for production
- [ ] HTTPS is enforced for all traffic
- [ ] Security headers are configured
- [ ] Input validation is enabled
- [ ] Logging is properly configured

## 🐳 Docker Deployment (Recommended)

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      DB_HOST: db
      REDIS_HOST: redis
      # Add all other environment variables
    depends_on:
      - db
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    volumes:
      - app_logs:/app/logs
      - app_uploads:/app/uploads

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: social_media_poster
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - app_logs:/var/log/nginx
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  app_logs:
  app_uploads:
```

### Production Dockerfile

Create `Dockerfile.prod`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Production stage
FROM node:18-alpine AS production

RUN apk add --no-cache curl

WORKDIR /app

# Copy built application
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create logs directory
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "backend/server.js"]
```

### Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
    
    # Upstream
    upstream app {
        server app:3001;
    }
    
    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name your-domain.com www.your-domain.com;
        return 301 https://$server_name$request_uri;
    }
    
    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com www.your-domain.com;
        
        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_session_tickets off;
        
        # Modern SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        
        # Security headers
        add_header Strict-Transport-Security "max-age=63072000" always;
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        add_header X-XSS-Protection "1; mode=block";
        add_header Referrer-Policy "strict-origin-when-cross-origin";
        
        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }
        
        # Auth routes with stricter rate limiting
        location /api/auth/ {
            limit_req zone=auth burst=10 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Health check
        location /health {
            proxy_pass http://app;
            access_log off;
        }
        
        # Static files
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
            
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
    }
}
```

### Deploy with Docker

```bash
# 1. Clone repository
git clone https://github.com/yourusername/social-media-poster.git
cd social-media-poster

# 2. Set up environment variables
cp .env.example .env.prod
# Edit .env.prod with production values

# 3. Generate SSL certificates (using Let's Encrypt)
./scripts/generate-ssl.sh your-domain.com

# 4. Build and start services
docker-compose -f docker-compose.prod.yml up -d

# 5. Run database migrations
docker-compose -f docker-compose.prod.yml exec app npm run migrate

# 6. Check health
curl -f https://your-domain.com/health
```

## ☁️ Cloud Deployment

### AWS Deployment

#### Using Elastic Beanstalk

1. **Prepare Application**
   ```bash
   # Create deployment package
   zip -r social-media-poster.zip . -x "node_modules/*" ".git/*"
   ```

2. **Create Elastic Beanstalk Application**
   ```bash
   # Install EB CLI
   pip install awsebcli
   
   # Initialize EB application
   eb init social-media-poster --platform node.js --region us-east-1
   
   # Create environment
   eb create production --database.engine postgres
   
   # Deploy
   eb deploy
   ```

3. **Configure Environment Variables**
   ```bash
   eb setenv NODE_ENV=production \
     JWT_SECRET=your-secret \
     DB_HOST=your-db-host \
     REDIS_HOST=your-redis-host
   ```

#### Using ECS with Fargate

Create `docker-compose.aws.yml`:

```yaml
version: '3.8'
services:
  app:
    image: your-account.dkr.ecr.region.amazonaws.com/social-media-poster:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    logging:
      driver: awslogs
      options:
        awslogs-group: social-media-poster
        awslogs-region: us-east-1
        awslogs-stream-prefix: app
```

Deploy script:
```bash
#!/bin/bash
# deploy-aws.sh

# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker build -t social-media-poster .
docker tag social-media-poster:latest your-account.dkr.ecr.us-east-1.amazonaws.com/social-media-poster:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/social-media-poster:latest

# Deploy to ECS
ecs-cli compose -f docker-compose.aws.yml service up --cluster social-media-poster --launch-type FARGATE
```

### Google Cloud Platform

#### Using Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/your-project/social-media-poster
gcloud run deploy social-media-poster \
  --image gcr.io/your-project/social-media-poster \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,JWT_SECRET=your-secret
```

### Digital Ocean

#### Using App Platform

Create `app.yaml`:

```yaml
name: social-media-poster
services:
- name: web
  source_dir: /
  dockerfile_path: Dockerfile.prod
  instance_count: 2
  instance_size_slug: basic-xxs
  routes:
  - path: /
  env:
  - key: NODE_ENV
    value: production
  - key: JWT_SECRET
    value: ${JWT_SECRET}
    type: SECRET
databases:
- engine: PG
  name: social-media-poster-db
  production: true
  version: "13"
```

Deploy:
```bash
doctl apps create --spec app.yaml
```

## 🖥️ Traditional Server Deployment

### Ubuntu/Debian Server Setup

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install Redis
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Install Nginx
sudo apt install nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install PM2 for process management
sudo npm install -g pm2
```

#### 2. Database Setup

```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE social_media_poster;
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE social_media_poster TO app_user;
\q
```

#### 3. Application Deployment

```bash
# Clone and setup application
git clone https://github.com/yourusername/social-media-poster.git
cd social-media-poster

# Install dependencies
npm install

# Build frontend
cd frontend && npm run build && cd ..

# Set up environment
cp backend/.env.example backend/.env
# Edit backend/.env with production values

# Run migrations
npm run migrate

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### 4. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
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
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024'
  }]
};
```

#### 5. Nginx Configuration

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/social-media-poster
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        root /home/user/social-media-poster/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/social-media-poster /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. SSL Certificate Setup

```bash
# Install Certbot
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Generate certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test renewal
sudo certbot renew --dry-run
```

## 🔍 Monitoring and Maintenance

### Health Monitoring

#### Health Check Endpoint

The application provides a comprehensive health check at `/health`:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": "15ms"
    },
    "redis": {
      "status": "healthy",
      "responseTime": "5ms"
    },
    "queue": {
      "status": "healthy",
      "waiting": 3,
      "active": 1,
      "failed": 0
    }
  }
}
```

#### Monitoring Setup

**Using PM2 Monitoring**:
```bash
# Enable PM2 monitoring
pm2 install pm2-server-monit
```

**Using Docker Health Checks**:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Logging

#### Log Configuration

Configure structured logging in `backend/src/utils/logger.js`:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

#### Log Aggregation

**Using ELK Stack**:
```yaml
# docker-compose.logging.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash/config:/usr/share/logstash/pipeline
      - app_logs:/var/log/app

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

### Backup Strategy

#### Database Backups

**Automated PostgreSQL Backups**:
```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
DB_NAME="social_media_poster"

mkdir -p $BACKUP_DIR

# Create backup
pg_dump -h localhost -U postgres $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/backup_$DATE.sql

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

**Cron job setup**:
```bash
# Add to crontab
0 2 * * * /home/user/scripts/backup-db.sh
```

#### Application Backups

```bash
#!/bin/bash
# backup-app.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/app"
APP_DIR="/home/user/social-media-poster"

mkdir -p $BACKUP_DIR

# Backup configuration and uploads
tar -czf $BACKUP_DIR/app_config_$DATE.tar.gz \
  $APP_DIR/backend/.env \
  $APP_DIR/uploads/ \
  $APP_DIR/logs/

echo "Application backup completed: app_config_$DATE.tar.gz"
```

### Performance Optimization

#### Redis Configuration

Optimize Redis for production in `redis.conf`:

```conf
# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Network
tcp-keepalive 300
timeout 0

# Security
requirepass your_redis_password
```

#### PostgreSQL Tuning

Optimize PostgreSQL settings:

```sql
-- postgresql.conf optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

#### Application Performance

**PM2 Cluster Mode**:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'social-media-poster',
    script: 'backend/server.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '1G'
  }]
};
```

### Security Hardening

#### Firewall Configuration

```bash
# Ubuntu/Debian firewall setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

#### SSL Security

**SSL Configuration Test**:
```bash
# Test SSL configuration
sudo nginx -t
curl -I https://your-domain.com
```

**Auto-renewal Setup**:
```bash
# Certbot auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔧 Troubleshooting

### Common Deployment Issues

#### Port Already in Use
```bash
# Find process using port
sudo lsof -i :3001
# Kill process
sudo kill -9 PID
```

#### Permission Issues
```bash
# Fix file permissions
sudo chown -R $USER:$USER /home/user/social-media-poster
chmod +x scripts/*.sh
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
# Test connection
psql -h localhost -U postgres -d social_media_poster
```

#### Redis Connection Issues
```bash
# Check Redis status
sudo systemctl status redis
# Test connection
redis-cli ping
```

### Deployment Rollback

#### Quick Rollback Strategy

```bash
#!/bin/bash
# rollback.sh

echo "Rolling back to previous version..."

# Stop current application
pm2 stop social-media-poster

# Restore previous backup
git checkout HEAD~1

# Install dependencies
npm install

# Restore database if needed
# psql -U postgres -d social_media_poster < /backups/postgres/backup_previous.sql

# Start application
pm2 start ecosystem.config.js --env production

echo "Rollback completed"
```

## 📚 Additional Resources

- **Monitoring**: [PM2 Monitoring Guide](https://pm2.keymetrics.io/docs/usage/monitoring/)
- **Security**: [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- **Performance**: [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- **Docker**: [Production Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

For deployment support, contact our team at devops@socialmediaposter.com