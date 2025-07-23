import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://mrecphuxcweignmdytal.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZWNwaHV4Y3dlaWdubWR5dGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNjY2MjMsImV4cCI6MjA2ODc0MjYyM30.4I-S7pvJT4py5Ui5cJL08euMdoTWd3YxDF_-IJYqHeY';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

