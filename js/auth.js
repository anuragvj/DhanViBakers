import { sb, setRemember } from "./supabaseClient.js";
import { systemMessage } from "./utils.js";

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const errorEl = document.getElementById("login-error");

// onSignedIn runs when someone signs in (not on every token refresh).
export function initAuth(onSignedIn) {
  let currentUserId = null;       // who is signed in right now
  let userClickedSignOut = false; // tells "I signed out" apart from "my session ended"

  function showSession(session) {
    if (session) {
      document.getElementById("user-email").textContent = session.user.email;
      loginView.classList.add("hidden");
      appView.classList.remove("hidden");
      errorEl.textContent = "";
      // Load the data only when the signed-in person changes, not on every refresh of the login
      if (currentUserId !== session.user.id) {
        currentUserId = session.user.id;
        onSignedIn(session);
      }
    } else {
      const wasSignedIn = currentUserId !== null;
      currentUserId = null;
      if (wasSignedIn) setRemember(false);
      // Close any open pop-up so it is not left on top of the login screen
      document.querySelectorAll("dialog[open]").forEach((d) => d.close());
      document.getElementById("password").value = "";
      appView.classList.add("hidden");
      loginView.classList.remove("hidden");
      if (wasSignedIn && !userClickedSignOut) {
        errorEl.textContent = "Your session ended. Please sign in again.";
      }
      userClickedSignOut = false;
    }
  }

  document.getElementById("login-btn").addEventListener("click", async () => {
    errorEl.textContent = "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    setRemember(document.getElementById("remember").checked); // must be set before signing in
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) errorEl.textContent = systemMessage(error) || "Login failed: " + error.message;
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    userClickedSignOut = true;
    const { error } = await sb.auth.signOut();
    if (error) {
      userClickedSignOut = false;
      alert(systemMessage(error) || "Could not sign out: " + error.message);
    }
  });

  sb.auth.onAuthStateChange((_event, session) => showSession(session));
  sb.auth.getSession().then(({ data }) => showSession(data.session));
}
