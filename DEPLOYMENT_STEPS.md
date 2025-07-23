# Step-by-Step Backend Deployment Guide

## Option 1: Deploy to Vercel (Recommended)

### Step 1: Prepare Files
1. Download the backend deployment package
2. Create a new folder in your GitHub repository called `backend` (if not exists)
3. Upload all files from the deployment package to the `backend` folder

### Step 2: Create Vercel Project
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Select your GitHub repository
4. Choose "Import"

### Step 3: Configure Project Settings
- **Project Name**: `osoul-backend` (or any name you prefer)
- **Framework Preset**: Other
- **Root Directory**: `backend` (if your backend is in a subfolder)
- **Build Command**: Leave empty
- **Output Directory**: Leave empty
- **Install Command**: `npm install`

### Step 4: Add Environment Variables
In the Vercel dashboard, go to Settings > Environment Variables and add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:OUSOL%401a159753@db.mrecphuxcweignmdytal.supabase.co:5432/postgres` |
| `SUPABASE_URL` | `https://mrecphuxcweignmdytal.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZWNwaHV4Y3dlaWdubWR5dGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNjY2MjMsImV4cCI6MjA2ODc0MjYyM30.4I-S7pvJT4py5Ui5cJL08euMdoTWd3YxDF_-IJYqHeY` |
| `JWT_SECRET` | `osoul_jwt_secret_key_production_2024_supabase_secure` |
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `FRONTEND_URL` | `https://your-frontend-url.vercel.app` |

**Important**: Replace `https://your-frontend-url.vercel.app` with your actual frontend URL!

### Step 5: Deploy
1. Click "Deploy"
2. Wait for deployment to complete (usually 1-2 minutes)
3. Copy your backend URL (e.g., `https://osoul-backend.vercel.app`)

### Step 6: Update Frontend Configuration
1. Go to your frontend Vercel project
2. Go to Settings > Environment Variables
3. Update or add: `VITE_API_URL` = `https://your-backend-url.vercel.app/api/v1`
4. Redeploy your frontend

### Step 7: Test the Application
1. Visit your frontend URL
2. Try logging in with: `admin@osoul.com` / `password123`
3. Login should now work!

## Option 2: Deploy to Railway

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### Step 2: Deploy from GitHub
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Select the backend folder

### Step 3: Add Environment Variables
Add the same environment variables as listed above in the Railway dashboard.

### Step 4: Deploy and Test
Railway will automatically deploy your backend and provide a URL.

## Verification Steps

### Test Backend Health
Visit: `https://your-backend-url.vercel.app/health`
Should return: `{"status":"OK","timestamp":"..."}`

### Test Login API
```bash
curl -X POST https://your-backend-url.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@osoul.com","password":"password123"}'
```

Should return user data and JWT token.

## Troubleshooting

### Issue: CORS Error
**Solution**: Update `FRONTEND_URL` environment variable with correct frontend URL

### Issue: Database Connection Error
**Solution**: Verify Supabase credentials are correct

### Issue: JWT Error
**Solution**: Ensure `JWT_SECRET` environment variable is set

### Issue: 404 on API calls
**Solution**: Verify `VITE_API_URL` in frontend points to correct backend URL

## Security Checklist

- [ ] Changed `JWT_SECRET` to a secure random string
- [ ] Updated `FRONTEND_URL` with actual frontend URL
- [ ] Verified all environment variables are set correctly
- [ ] Tested login functionality
- [ ] Checked that sensitive data is not exposed in logs

## Next Steps

After successful deployment:
1. Test all login functionality
2. Verify user roles work correctly
3. Test other API endpoints as needed
4. Set up monitoring and logging
5. Consider implementing additional security measures

Your backend is now deployed and ready to handle authentication requests! 🚀

