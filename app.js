// Paste your own values between the quotes.
const SUPABASE_URL = "https://icffxjvysfjlyxncogrn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Sm2-5Dx5jJx828mnyI8N0A_W9Ndv01z";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const errorEl = document.getElementById("login-error");

// All dates in the app are shown in Indian Standard Time.
function formatIST(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) + " IST";
}

function showSession(session) {
  if (session) {
    document.getElementById("user-email").textContent = session.user.email;
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
  } else {
    appView.classList.add("hidden");
    loginView.classList.remove("hidden");
  }
}

document.getElementById("login-btn").addEventListener("click", async () => {
  errorEl.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) errorEl.textContent = "Login failed: " + error.message;
});

document.getElementById("logout-btn").addEventListener("click", () => sb.auth.signOut());

sb.auth.onAuthStateChange((_event, session) => showSession(session));
sb.auth.getSession().then(({ data }) => showSession(data.session));
