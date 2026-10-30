// All dates in the app are shown in Indian Standard Time.
export function formatIST(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) + " IST";
}

// Add a text cell to a table row.
export function addCell(tr, text) {
  const td = document.createElement("td");
  td.textContent = text;
  tr.appendChild(td);
  return td;
}

// Turns a connection problem or an expired login into a plain message.
// Returns null for any other kind of error, so callers keep their own wording.
export function systemMessage(error) {
  if (!error) return null;
  const text = `${error.name || ""} ${error.message || ""}`.toLowerCase();

  if (text.includes("jwt expired") || error.code === "PGRST301" || error.code === "PGRST303") {
    return "Your session has expired. Reload the page and sign in again.";
  }

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const fetchFailed = ["failed to fetch", "networkerror", "fetch failed", "load failed", "network request failed"]
    .some((s) => text.includes(s));
  if (offline || fetchFailed) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return null;
}
