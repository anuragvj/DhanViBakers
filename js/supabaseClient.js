import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

// "Keep me signed in" decides where the login is stored:
//   ticked:   localStorage   (survives closing the browser)
//   unticked: sessionStorage (cleared when the browser is closed)
const REMEMBER_KEY = "dhanvi-remember";

function wantsRemember() {
  try { return localStorage.getItem(REMEMBER_KEY) === "1"; } catch { return false; }
}

// Called by the login screen before signing in, and when signing out.
export function setRemember(on) {
  try {
    if (on) localStorage.setItem(REMEMBER_KEY, "1");
    else localStorage.removeItem(REMEMBER_KEY);
  } catch { /* storage blocked: nothing to do */ }
}

// A storage adapter that Supabase uses instead of its default (always localStorage).
const sessionStore = {
  getItem(key) {
    try { return sessionStorage.getItem(key) ?? localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    try {
      if (wantsRemember()) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch { /* storage blocked */ }
  },
  removeItem(key) {
    try { sessionStorage.removeItem(key); localStorage.removeItem(key); } catch { /* storage blocked */ }
  },
};

// "supabase" comes from the library script tag in index.html.
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { storage: sessionStore },
});
