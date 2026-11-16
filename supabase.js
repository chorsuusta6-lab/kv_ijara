
const SUPABASE_URL = "https://rztjhfcgvbsygfospnqt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sqwarXIZstx8IKZ2bHYsDA_ajhS-X3H";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.db = supabaseClient;

console.log('✅ Supabase ulanish tayyor');