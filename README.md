# 🚀 Social Media Poster

A comprehensive, enterprise-grade social media management platform that enables teams to schedule, publish, and manage content across multiple social media platforms from a single dashboard.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)
![React](https://img.shields.io/badge/react-18+-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5+-blue.svg)

## ✨ Features

### 🎯 Core Features
- **Multi-Platform Publishing** - Post to LinkedIn and X/Twitter simultaneously
- **Advanced Scheduling** - Schedule posts with timezone support and precise timing
- **Team Collaboration** - Multi-user support with role-based access control
- **Rich Content** - Support for text posts, images, and media attachments
- **Queue Management** - Reliable job processing with retry logic and failure handling

### 🔧 Technical Features
- **RESTful API** - Comprehensive API with JWT authentication
- **Real-time Dashboard** - React-based web interface with live updates
- **Webhook Notifications** - Event-driven notifications for integrations
- **Rate Limiting** - Intelligent rate limiting with user and endpoint-specific rules
- **Analytics & Reporting** - Detailed post performance and platform analytics
- **Docker Ready** - Full containerization support for easy deployment

### 🔐 Security & Reliability
- **OAuth 2.0/1.0a** - Secure platform authentication
- **JWT Tokens** - Stateless authentication with refresh token rotation
- **HMAC Webhooks** - Cryptographically signed webhook payloads
- **Input Validation** - Comprehensive request validation and sanitization
- **Error Handling** - Graceful error handling with detailed logging

## Tech Stack

### Backend
- Node.js + Express
- PostgreSQL + Redis
- Bull Queue
- Passport.js (OAuth)
- Jest (Testing)

### Frontend
- React 18 + Vite
- TailwindCSS
- React Query
- React Hook Form
- Playwright (E2E)

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- npm 9+

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/social-media-poster.git
cd social-media-poster
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your configuration
```

### 4. Start with Docker (Recommended)
```bash
npm run docker:up
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379
- Backend API on port 3001
- Frontend on port 5173

### 5. Run database migrations
```bash
npm run db:migrate
```

### 6. (Optional) Seed sample data
```bash
npm run db:seed
```

### 7. Access the application
Open http://localhost:5173 in your browser

## Development

### Start development servers
```bash
npm run dev
```

### Run tests
```bash
# All tests
npm test

# Backend tests only
npm run test:backend

# Frontend tests only
npm run test:frontend
```

### Linting
```bash
npm run lint
```

## Project Structure

```
social-media-poster/
├── backend/           # Express API server
│   ├── src/
│   │   ├── config/    # Configuration files
│   │   ├── models/    # Database models
│   │   ├── services/  # Business logic
│   │   ├── controllers/ # Route handlers
│   │   └── routes/    # API routes
│   └── tests/         # Backend tests
├── frontend/          # React application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── hooks/     # Custom hooks
│   │   └── services/  # API services
│   └── tests/         # Frontend tests
└── docker/            # Docker configuration
```

## API Documentation

See [API Documentation](docs/API.md) for detailed API endpoints and usage.

## Platform Setup

See [Platform Setup Guide](docs/PLATFORMS.md) for OAuth configuration instructions.

## Testing

### Coverage Goals
- Unit Tests: 90% coverage
- Integration Tests: All critical paths
- E2E Tests: Main user workflows

### Running Tests
```bash
# Unit tests with coverage
cd backend && npm run test:unit

# Integration tests
cd backend && npm run test:integration

# E2E tests
cd frontend && npm run test:e2e
```

## Docker Support

### Build images
```bash
docker-compose -f docker/docker-compose.yml build
```

### Start services
```bash
docker-compose -f docker/docker-compose.yml up
```

### Stop services
```bash
docker-compose -f docker/docker-compose.yml down
```

## CI/CD

GitHub Actions workflow includes:
- Linting
- Unit & Integration tests
- Security scanning
- Docker image building
- Automated deployment (on main branch)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open a GitHub issue.