# Supabase Setup Guide

This guide will help you connect your backend to Supabase.

## Prerequisites

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new Supabase project

## Setup Steps

### 1. Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the following values:
   - Project URL (this is your `SUPABASE_URL`)
   - Anon/Public key (this is your `SUPABASE_ANON_KEY`)
   - Service role key (this is your `SUPABASE_SERVICE_ROLE_KEY`)

### 2. Configure Environment Variables

Create a `.env` file in the backend directory (if it doesn't exist) and add:

```env
# Supabase Configuration
USE_SUPABASE=true
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# If using Supabase's hosted PostgreSQL directly
DATABASE_URL=your-supabase-postgres-connection-string
```

### 3. Migrate Your Database Schema

#### Option 1: Using Supabase Dashboard (Recommended for initial setup)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `backend/database/schema.sql`
4. Paste and run the SQL in the editor

#### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Create a new migration
supabase migration new initial_schema

# Copy your schema.sql content to the migration file
# Then run:
supabase db push
```

### 4. Enable Row Level Security (RLS)

For production use, you should enable RLS on your tables:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
-- ... repeat for all tables

-- Create policies (example for users table)
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Only admins can insert users" ON users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
```

## Using Supabase in Your Code

### 1. Direct Supabase Client Usage

The Supabase client is configured in `src/config/supabase.js`:

```javascript
import supabase from './config/supabase.js';

// Query data
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('role', 'admin');

// Insert data
const { data, error } = await supabase
  .from('collections')
  .insert({ amount: 1000, branch_id: 1 });

// Update data
const { data, error } = await supabase
  .from('users')
  .update({ last_login: new Date() })
  .eq('id', userId);

// Delete data
const { data, error } = await supabase
  .from('collections')
  .delete()
  .eq('id', collectionId);
```

### 2. Using the Supabase Service

A service wrapper is available at `src/services/supabase.service.js`:

```javascript
import supabaseService from './services/supabase.service.js';

// Select with filters
const users = await supabaseService.select('users', '*', { role: 'admin' });

// Insert
const newUser = await supabaseService.insert('users', {
  email: 'user@example.com',
  first_name: 'John',
  last_name: 'Doe'
});

// Update
const updated = await supabaseService.update(
  'users', 
  { last_login: new Date() }, 
  { id: userId }
);

// Delete
const deleted = await supabaseService.delete('users', { id: userId });
```

### 3. Authentication with Supabase

Supabase provides built-in authentication:

```javascript
// Sign up
const { user, session } = await supabaseService.signUp(email, password);

// Sign in
const { user, session } = await supabaseService.signIn(email, password);

// Sign out
await supabaseService.signOut();

// Get current user
const user = await supabaseService.getUser();
```

### 4. Real-time Subscriptions

Subscribe to database changes in real-time:

```javascript
// Subscribe to all changes in a table
const channel = supabaseService.subscribe('collections', {}, (payload) => {
  console.log('Change received!', payload);
});

// Unsubscribe
supabaseService.unsubscribe(channel);
```

### 5. File Storage

Supabase includes file storage:

```javascript
// Upload file
const { data, error } = await supabaseService.uploadFile(
  'avatars',
  'user-123.png',
  file
);

// Get public URL
const url = await supabaseService.getPublicUrl('avatars', 'user-123.png');

// Download file
const blob = await supabaseService.downloadFile('avatars', 'user-123.png');

// Delete file
await supabaseService.deleteFile('avatars', ['user-123.png']);
```

## Switching Between PostgreSQL and Supabase

The project supports both direct PostgreSQL and Supabase. To switch:

1. Set `USE_SUPABASE=false` in `.env` to use direct PostgreSQL
2. Set `USE_SUPABASE=true` in `.env` to use Supabase

When using the database adapter (`src/config/database-adapter.js`), it will automatically use the correct connection based on this setting.

## Best Practices

1. **Use Row Level Security (RLS)**: Always enable RLS on your tables in production
2. **Service Role Key**: Only use the service role key on the server-side, never expose it to clients
3. **Anon Key**: The anon key is safe to use in client-side code
4. **Real-time**: Use real-time subscriptions sparingly to avoid overwhelming your quota
5. **Indexes**: Create appropriate indexes for better query performance
6. **Backup**: Regular backups are automatically handled by Supabase

## Troubleshooting

### Connection Issues
- Verify your Supabase URL and keys are correct
- Check if your project is not paused (free tier projects pause after inactivity)
- Ensure your IP is not blocked in Supabase settings

### Authentication Issues
- Make sure you've enabled the authentication providers you want to use in Supabase dashboard
- Check if email confirmations are required (disable for development)

### Performance Issues
- Add appropriate indexes to your tables
- Use select with specific columns instead of `*`
- Implement pagination for large datasets

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)