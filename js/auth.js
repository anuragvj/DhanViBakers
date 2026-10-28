import { sb } from "./supabaseClient.js";

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const errorEl = document.getElementById("login-error");

// onSignedIn runs whenever a signed-in session is detected.
export function initAuth(onSignedIn) {
  function showSession(session) {
    if (session) {
      document.getElementById("user-email").textContent = session.user.email;
      loginView.classList.add("hidden");
      appView.classList.remove("hidden");
      onSignedIn(session);
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
}
