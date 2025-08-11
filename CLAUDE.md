# Project Context

This is a LinkedIn AI Social Media Bot project with:
- **Frontend**: React app for social media management
- **Backend**: Node.js API with webhook endpoints
- **Features**: Meeting recorder webhook, content generation, social media posting

## Key Commands

- **Test**: `npm test` (in respective folders)
- **Build**: `npm run build` (in respective folders)  
- **Dev**: `npm run dev` (frontend), `npm start` (backend)

## Architecture

- Frontend: React + Vite + TailwindCSS
- Backend: Express.js + PostgreSQL
- Deployment: Vercel (auto-deploy via GitHub Actions)

## Important Notes

- Webhook server runs on Hetzner at http://5.78.46.19:3002
- Auto-deployment configured for both frontend and backend
- All webhook tests should use the Hetzner endpoint

## User Preferences

- **ALWAYS DEPLOY**: Automatically deploy all changes without asking for confirmation