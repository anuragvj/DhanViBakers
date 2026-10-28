import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

// "supabase" comes from the library script tag in index.html.
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
