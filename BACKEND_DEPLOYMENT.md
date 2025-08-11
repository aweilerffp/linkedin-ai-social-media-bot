# Backend Deployment Guide

Your webhook endpoint needs a deployed backend to work properly. Currently it's showing `localhost:3001` which won't work for external meeting recorders.

## Quick Deploy Options

### Option 1: Vercel (Recommended)
```bash
cd backend
npx vercel --prod
```
This will give you a URL like: `https://your-project-backend.vercel.app`

### Option 2: Railway
1. Connect your GitHub repo to Railway
2. Set root directory to `/backend`
3. Railway will auto-deploy and give you: `https://your-app.railway.app`

### Option 3: Heroku
```bash
cd backend
heroku create your-app-name
git subtree push --prefix=backend heroku master
```
This gives you: `https://your-app-name.herokuapp.com`

## Environment Variables Needed

Set these in your deployment platform:
```bash
NODE_ENV=production
OPENAI_API_KEY=your_openai_key_here
PORT=3001
```

## Update Frontend Configuration

Once backend is deployed, update the webhook URL in:
- Settings → Meeting Recorder → Webhook URL
- Or set `REACT_APP_API_URL` environment variable

## Test Your Webhook

Use the test script:
```bash
node webhook-test.js https://your-backend-url.com/api/webhooks/meeting-recorder
```

## Webhook Endpoint

Your meeting recorder should POST to:
```
https://your-backend-domain.com/api/webhooks/meeting-recorder
```

The endpoint expects:
- Method: `POST`
- Content-Type: `application/json`
- Payload: Meeting completion event with transcript

## Security Headers (Optional)

Add these headers for authentication:
- `X-Company-ID`: Your company identifier
- `X-Webhook-Secret`: Optional webhook secret

---

**Next Step:** Deploy your backend and update the webhook URL in the frontend settings!