# Project Context

This is a LinkedIn AI Social Media Bot project with:
- **Frontend**: React app for social media management
- **Backend**: Node.js API with webhook endpoints
- **Features**: Meeting recorder webhook, content generation, social media posting

## Key Commands

- **Test**: `npm test` (in respective folders)
- **Build**: `npm run build` (in respective folders)  
- **Dev**: `npm run dev` (frontend), `npm start` (backend)
- **Lint**: `npm run lint` (if available)
- **Type Check**: `npm run typecheck` (if available)

## Architecture

- Frontend: React + Vite + TailwindCSS
- Backend: Express.js + PostgreSQL
- Deployment: Vercel (auto-deploy via GitHub Actions)

## Important Notes

- Webhook server runs on Hetzner at http://5.78.46.19:3002
- Auto-deployment configured for both frontend and backend
- All webhook tests should use the Hetzner endpoint

## Testing & QA Process

For every feature update, ensure the following:

### 1. Development Testing
- Run `npm test` in both frontend and backend folders
- Run `npm run build` to verify no build errors
- Test locally with `npm run dev` (frontend) and `npm start` (backend)
- Run linting and type checking if available

### 2. Webhook Testing
- **Webhook URL**: `http://5.78.46.19:3002/api/webhooks/meeting-recorder`
- **Health Check**: `curl http://5.78.46.19:3002/health`
- **Test Payload**: Send sample meeting recorder payloads to verify processing
- **Check Logs**: `pm2 logs webhook-server` to verify successful processing
- **Verify Response**: Ensure webhook returns marketing hooks in correct format

### 3. Integration Testing
- Test auto-generate webhook URL functionality
- Verify webhook configuration saves correctly
- Test with different payload formats (Read.ai, Zoom, custom)
- Confirm CORS and cross-origin handling

### 4. Deployment Verification
- Verify GitHub Actions workflows pass
- Check Vercel deployment logs for any issues
- Test production URLs after deployment
- Verify PM2 webhook server remains running

### 5. User Acceptance Testing
- Test complete user workflow from webhook setup to marketing hook generation
- Verify UI/UX is clear and functional
- Confirm error handling and user feedback is appropriate
- Test on different browsers if frontend changes made

## User Preferences

- **ALWAYS DEPLOY**: Automatically deploy all changes without asking for confirmation
- **ALWAYS TEST**: Run comprehensive testing checklist for each feature update
- **VERIFY WEBHOOKS**: Always confirm webhook functionality after changes