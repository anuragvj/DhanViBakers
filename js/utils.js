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
