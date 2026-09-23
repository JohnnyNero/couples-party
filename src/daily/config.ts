// The couple's Supabase project. The anon key is meant to ship to the browser — it's
// the same key every visitor gets, and on its own it can do nothing: the tables have
// row level security with no policies, so the only way in is the six functions in
// supabase/migrations, each of which checks who's calling. Never put the service_role
// key here, or anywhere in this repo.
export const SUPABASE_URL = 'https://jzplpotgeodzkrpqojwt.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6cGxwb3RnZW9kemtycHFvand0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNTU5MjUsImV4cCI6MjEwNTczMTkyNX0.0UMZoBqBa1ZHq5Dh62xsCyNfMMrvl3p6-0GIbjGDGeQ'
