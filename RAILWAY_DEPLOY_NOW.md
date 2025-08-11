# 🚀 Deploy to Railway NOW - Step by Step

## Quick Deploy (5 minutes)

### Step 1: Go to Railway
Open: https://railway.app

### Step 2: Sign In
- Click "Login" 
- Choose "GitHub" (easiest)
- Authorize Railway to access your repos

### Step 3: Deploy
- Click "Deploy from GitHub repo"
- Search for: `linkedin-ai-social-media-bot`
- Select your repository
- Click "Deploy"

### Step 4: Configure
1. **Set Root Directory:**
   - Go to Settings → Service Settings
   - Set "Root Directory" to: `backend`

2. **Add Environment Variables:**
   - Go to Variables tab
   - Add these variables:
   ```
   NODE_ENV = production
   OPENAI_API_KEY = sk-your-openai-api-key-here
   CORS_ORIGIN = https://linkedin-ai-social-media-bot.vercel.app
   ```
   
   ⚠️ **Important:** Get your OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Step 5: Deploy!
- Railway will auto-build and deploy
- Wait 2-3 minutes for deployment
- You'll get a URL like: `https://backend-production-abc123.up.railway.app`

### Step 6: Update Frontend
1. Copy your Railway URL
2. Go to your frontend: Settings → Meeting Recorder
3. Paste URL as: `https://your-railway-url.up.railway.app/api/webhooks/meeting-recorder`
4. Click "Save Configuration"

## 🧪 Test Your Webhook
```bash
curl -X POST https://your-railway-url.up.railway.app/api/webhooks/meeting-recorder \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "meeting.completed",
    "timestamp": "2025-08-11T21:00:00Z",
    "data": {
      "meeting_id": "test_123",
      "transcript": "This is a test meeting about our new product features.",
      "title": "Product Strategy Meeting"
    }
  }'
```

## ✅ Success Indicators
- Railway shows "Deployed" status
- Health check works: `https://your-url.up.railway.app/health`
- Webhook responds with marketing hooks

---

**Go to https://railway.app and follow steps above - your webhook will be live in 5 minutes!** 🚀