# Osoul Backend - Vercel Deployment

## Quick Deploy to Vercel

### 1. Create New Vercel Project
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import from your GitHub repository
4. Select the backend folder or create a separate repository for this backend

### 2. Configure Vercel Settings
- **Framework Preset**: Other
- **Root Directory**: Leave empty (or set to backend folder if in monorepo)
- **Build Command**: Leave empty
- **Output Directory**: Leave empty
- **Install Command**: `npm install`

### 3. Environment Variables
Add these environment variables in Vercel dashboard:

```
DATABASE_URL=postgresql://postgres:OUSOL%401a159753@db.mrecphuxcweignmdytal.supabase.co:5432/postgres
SUPABASE_URL=https://mrecphuxcweignmdytal.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZWNwaHV4Y3dlaWdubWR5dGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNjY2MjMsImV4cCI6MjA2ODc0MjYyM30.4I-S7pvJT4py5Ui5cJL08euMdoTWd3YxDF_-IJYqHeY
JWT_SECRET=osoul_jwt_secret_key_production_2024_supabase_secure_change_this
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-url.vercel.app
```

### 4. Deploy
Click "Deploy" and wait for deployment to complete.

### 5. Update Frontend
After backend deployment, update your frontend environment variables:
```
VITE_API_URL=https://your-backend-url.vercel.app/api/v1
```

## Test Endpoints

After deployment, test these endpoints:

- **Health Check**: `GET https://your-backend-url.vercel.app/health`
- **Login**: `POST https://your-backend-url.vercel.app/api/v1/auth/login`

## Test Users

```json
{
  "email": "admin@osoul.com",
  "password": "password123"
}
```

## Troubleshooting

### Common Issues:
1. **CORS Errors**: Update `FRONTEND_URL` environment variable
2. **Database Connection**: Verify Supabase credentials
3. **JWT Errors**: Ensure `JWT_SECRET` is set correctly

### Logs:
Check Vercel function logs in the dashboard for detailed error information.

## Security Notes

- Change `JWT_SECRET` to a secure random string
- Update `FRONTEND_URL` with your actual frontend URL
- Consider enabling additional security features in production

