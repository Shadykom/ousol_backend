import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://mrecphuxcweignmdytal.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZWNwaHV4Y3dlaWdubWR5dGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNjY2MjMsImV4cCI6MjA2ODc0MjYyM30.4I-S7pvJT4py5Ui5cJL08euMdoTWd3YxDF_-IJYqHeY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupSupabaseTables() {
  console.log('Setting up Supabase tables...\n');
  
  console.log('IMPORTANT: You need to run the SQL schema in Supabase Dashboard');
  console.log('=========================================================\n');
  
  console.log('Steps to set up your database:');
  console.log('1. Go to your Supabase project: https://supabase.com/dashboard/project/mrecphuxcweignmdytal');
  console.log('2. Click on "SQL Editor" in the left sidebar');
  console.log('3. Click on "New query"');
  console.log('4. Copy the contents of backend/database/schema.sql');
  console.log('5. Paste it in the SQL editor');
  console.log('6. Click "Run" to execute the SQL\n');
  
  console.log('Testing Supabase connection...');
  
  try {
    // Test connection by trying to query a table
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .single();
    
    if (error) {
      if (error.code === '42P01') {
        console.log('\n❌ Tables not found. Please run the schema.sql in Supabase Dashboard first.');
      } else {
        console.log('\n⚠️  Connection successful but tables might not be set up yet.');
        console.log('Error details:', error.message);
      }
    } else {
      console.log('\n✅ Supabase connection successful and tables are set up!');
    }
  } catch (err) {
    console.error('\n❌ Failed to connect to Supabase:', err.message);
  }
  
  console.log('\nAfter setting up the tables, your Railway deployment should work with Supabase!');
}

setupSupabaseTables();