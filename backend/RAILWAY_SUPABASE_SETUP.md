# Railway + Supabase Setup Guide

## Overview
This guide will help you connect your Railway-deployed backend to your Supabase database.

## Step 1: Configure Railway Environment Variables

Add these environment variables to your Railway project:

```bash
USE_SUPABASE=true
SUPABASE_URL=https://mrecphuxcweignmdytal.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZWNwaHV4Y3dlaWdubWR5dGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNjY2MjMsImV4cCI6MjA2ODc0MjYyM30.4I-S7pvJT4py5Ui5cJL08euMdoTWd3YxDF_-IJYqHeY
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
```

### How to add environment variables in Railway:
1. Go to your Railway project dashboard
2. Click on your service (backend)
3. Go to the "Variables" tab
4. Click "Add Variable" for each environment variable
5. Save and Railway will automatically redeploy

## Step 2: Set Up Database Tables in Supabase

### Option A: Using Supabase Dashboard (Recommended)
1. Go to your [Supabase project dashboard](https://supabase.com/dashboard/project/mrecphuxcweignmdytal)
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy the contents of `backend/database/supabase-schema.sql`
5. Paste it in the SQL editor
6. Click "Run" to execute the SQL

### Option B: Using the original schema
If you prefer to use the original schema without RLS policies:
1. Use `backend/database/schema.sql` instead
2. Follow the same steps as Option A

## Step 3: Verify the Connection

After Railway redeploys with the new environment variables:

1. Check your Railway deployment logs for any connection errors
2. Your API endpoints should now be working with Supabase

## Step 4: Test the API

You can test your deployed API:

```bash
# Replace with your Railway deployment URL
curl https://your-app.railway.app/health
```

## Important Notes

### Security Considerations
1. The provided `SUPABASE_ANON_KEY` is safe to use in your backend as it's meant for public access
2. For production, consider using a service role key for admin operations
3. Change the `JWT_SECRET` to a secure random string in production

### Row Level Security (RLS)
The `supabase-schema.sql` includes basic RLS policies. You may need to adjust these based on your authentication flow.

### Database Access
If you need direct PostgreSQL access, you can get the connection string from:
1. Supabase Dashboard → Settings → Database
2. Connection string format: `postgresql://postgres:[YOUR-PASSWORD]@db.mrecphuxcweignmdytal.supabase.co:5432/postgres`

## Troubleshooting

### Connection Issues
- Ensure all environment variables are correctly set in Railway
- Check Railway logs for specific error messages
- Verify Supabase project is active and not paused

### Table Not Found Errors
- Make sure you've run the schema SQL in Supabase
- Check if tables were created successfully in Supabase Table Editor

### Authentication Issues
- Ensure JWT_SECRET matches between your backend and any frontend authentication
- Check if RLS policies are too restrictive

## Next Steps

1. Update your frontend to point to the Railway backend URL
2. Configure CORS in Railway if needed (add FRONTEND_URL environment variable)
3. Set up proper authentication flow between frontend and backend
4. Monitor your Supabase usage in the dashboard

## Support

- [Railway Documentation](https://docs.railway.app/)
- [Supabase Documentation](https://supabase.com/docs)
- Check `backend/SUPABASE_SETUP.md` for more detailed Supabase integration information