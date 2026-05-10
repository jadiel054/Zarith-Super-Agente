
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the correct .env file
dotenv.config({ path: path.resolve(process.cwd(), 'artifacts/zarith/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getRecentProjects() {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    console.log('Most recent projects:', projects);
  } catch (err) {
    console.error('An unexpected error occurred:', err);
  }
}

getRecentProjects();
