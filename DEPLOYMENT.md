# Railway Deployment Guide

## Prerequisites
- GitHub account
- Railway account (free at railway.app)
- Supabase project

## Step 1: Prepare Your Repository
1. Push your code to GitHub
2. Make sure all files are committed

## Step 2: Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository
6. Railway will automatically detect Node.js and Python

## Step 3: Configure Environment Variables
In Railway dashboard, go to Variables tab and add:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
CORS_ORIGIN=https://your-railway-domain.railway.app
TRANSLATION_SERVICE_URL=https://your-railway-domain.railway.app
NEXT_PUBLIC_SERVER_URL=https://your-railway-domain.railway.app
NODE_ENV=production
PORT=5000
```

## Step 4: Deploy
1. Railway will automatically build and deploy
2. Wait for deployment to complete
3. Your app will be available at the provided Railway URL

## Step 5: Test Your Deployment
1. Visit your Railway URL
2. Test user registration and login
3. Test real-time messaging
4. Test translation functionality

## Troubleshooting
- Check Railway logs for any errors
- Ensure all environment variables are set correctly
- Verify Supabase connection in Railway logs
- Check if Python translation service is running

## Notes
- Railway supports both Node.js and Python
- Socket.IO works perfectly on Railway
- Free tier includes 500 hours/month
- Automatic deployments on git push
