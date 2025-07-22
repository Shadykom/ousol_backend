import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import supabase from '../src/config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateSupabase() {
  try {
    console.log('Starting Supabase database migration...');
    
    // Read the schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    // Note: Supabase doesn't have a direct SQL execution method in the JS client
    // You'll need to run the SQL through Supabase's SQL editor in the dashboard
    // Or use the Supabase CLI for migrations
    
    console.log('\n=== IMPORTANT ===');
    console.log('To migrate your database schema to Supabase, you have two options:\n');
    
    console.log('Option 1: Use Supabase Dashboard');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of backend/database/schema.sql');
    console.log('4. Run the SQL commands\n');
    
    console.log('Option 2: Use Supabase CLI');
    console.log('1. Install Supabase CLI: npm install -g supabase');
    console.log('2. Login: supabase login');
    console.log('3. Link your project: supabase link --project-ref your-project-ref');
    console.log('4. Create a migration: supabase migration new initial_schema');
    console.log('5. Copy schema.sql content to the migration file');
    console.log('6. Run: supabase db push\n');
    
    console.log('The schema file is located at:', schemaPath);
    
    // Test connection
    const { data, error } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.error('Supabase connection error:', error);
    } else {
      console.log('\nSupabase connection successful!');
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run migration
migrateSupabase();