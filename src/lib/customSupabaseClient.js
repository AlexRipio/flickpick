import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kjpgmcjzdqzwtkyljvhq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcGdtY2p6ZHF6d3RreWxqdmhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTgzMDQsImV4cCI6MjA3MzM3NDMwNH0.9dA3x5n5H6QgYD1aSTPEOE6NezQgm84-4N_eBgXe1Ss';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);