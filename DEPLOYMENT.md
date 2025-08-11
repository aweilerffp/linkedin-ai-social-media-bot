# 🚀 Auto-Deployment Setup

## ✅ Configured Features

### 1. **GitHub Actions Workflows**
- **Backend**: Auto-deploys to Vercel on every push to `backend/` folder
- **Frontend**: Auto-deploys to Vercel on every push to `frontend/` folder
- **Manual Trigger**: Can trigger deployments manually via GitHub Actions tab

### 2. **Production URLs**
- **Frontend**: https://linkedin-ai-social-media-bot.vercel.app
- **Backend**: https://linkedin-ai-social-media-bot-backend.vercel.app
- **Webhook**: https://linkedin-ai-social-media-bot-backend.vercel.app/api/webhooks/meeting-recorder

## ⚙️ Required Secrets (In GitHub Settings)

Go to **Settings → Secrets and Variables → Actions** and add:

```
VERCEL_TOKEN=your-vercel-personal-token
VERCEL_ORG_ID=your-vercel-org-id  
VERCEL_PROJECT_ID=your-backend-project-id
VERCEL_FRONTEND_PROJECT_ID=your-frontend-project-id
```

## 🔧 How to Get Vercel Secrets

### 1. Get VERCEL_TOKEN
- Go to [Vercel Settings](https://vercel.com/account/tokens)
- Click "Create Token"
- Copy the token

### 2. Get Project IDs & Org ID
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# In your backend folder
cd backend
vercel link
# This shows your VERCEL_PROJECT_ID and VERCEL_ORG_ID

# In your frontend folder  
cd ../frontend
vercel link
# This shows your VERCEL_FRONTEND_PROJECT_ID
```

## 🎯 Deployment Triggers

**Auto-Deploy Triggers:**
- Push to `master` branch
- Changes in `backend/` → deploys backend
- Changes in `frontend/` → deploys frontend

**Manual Deploy:**
- Go to GitHub → Actions → Choose workflow → "Run workflow"

## 📋 Post-Setup Steps

1. **Add GitHub secrets** (above)
2. **Push any change** to trigger first deployment
3. **Update frontend webhook URL** to: 
   ```
   https://linkedin-ai-social-media-bot-backend.vercel.app/api/webhooks/meeting-recorder
   ```

## 🧪 Testing Deployments

**Health Checks:**
- Frontend: https://linkedin-ai-social-media-bot.vercel.app
- Backend: https://linkedin-ai-social-media-bot-backend.vercel.app/health

**Test Webhook:**
```bash
curl -X POST https://linkedin-ai-social-media-bot-backend.vercel.app/api/webhooks/meeting-recorder \
  -H "Content-Type: application/json" \
  -d '{"event_type": "meeting.completed", "data": {"meeting_id": "test", "transcript": "test"}}'
```

---

**🎉 All future updates now deploy automatically to Vercel!**