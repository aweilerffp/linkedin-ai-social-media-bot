# 🚀 Deploy Your Backend NOW!

Your webhook URL is currently showing `localhost:3001` - let's fix that by deploying your backend!

## ⚡ Quick Deploy Options (Choose One)

### Option 1: Railway (Recommended - Easiest)
1. Go to [railway.app](https://railway.app)
2. Click "Deploy from GitHub repo"
3. Connect to: `aweilerffp/linkedin-ai-social-media-bot`
4. Set Root Directory: `/backend`
5. Deploy automatically gives you: `https://your-app-name.railway.app`

### Option 2: Render (Also Easy)
1. Go to [render.com](https://render.com)
2. Click "New Web Service" → "Connect Repository"  
3. Select: `aweilerffp/linkedin-ai-social-media-bot`
4. Set Root Directory: `backend`
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Deploy gives you: `https://your-app-name.onrender.com`

### Option 3: Vercel (Manual)
```bash
cd backend
npx vercel --prod
# Follow prompts, gives you: https://your-app-backend.vercel.app
```

### Option 4: Heroku
```bash
cd /root/social-media-poster
heroku create your-app-name-backend
git subtree push --prefix=backend heroku master
# Gives you: https://your-app-name-backend.herokuapp.com
```

## ⚙️ Environment Variables to Set

In your deployment platform, add:
```bash
NODE_ENV=production
OPENAI_API_KEY=your_openai_api_key_here
PORT=$PORT
```

## 🔗 After Deployment

1. Copy your new backend URL (e.g., `https://your-app.railway.app`)
2. Go to your frontend: Settings → Meeting Recorder  
3. Update Webhook URL to: `https://your-app.railway.app/api/webhooks/meeting-recorder`
4. Test webhook - it should work!

## 🧪 Test Your Deployed Webhook

```bash
curl -X POST https://your-backend-url.com/api/webhooks/meeting-recorder \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "meeting.completed",
    "timestamp": "2025-08-11T21:00:00Z", 
    "data": {
      "meeting_id": "test123",
      "transcript": "This is a test meeting transcript.",
      "title": "Test Meeting"
    }
  }'
```

## 🎯 Quick Links to Deploy:

- **Railway:** [Deploy Now](https://railway.app/new) → Connect GitHub → Select repo → Set `/backend` as root
- **Render:** [Deploy Now](https://dashboard.render.com/select-repo) → Connect GitHub → Select repo → Set backend settings
- **Vercel:** Run `npx vercel --prod` in `/backend` folder

---

**Choose one option above and deploy now - your webhook will be ready in 2-3 minutes!** 🚀