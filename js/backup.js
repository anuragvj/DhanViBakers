import { sb } from "./supabaseClient.js";
import { formatIST, systemMessage } from "./utils.js";

// The tables in the backup, and the column each is sorted by so pages never overlap.
const TABLES = [
  { name: "ingredients", order: "id", label: "ingredients" },
  { name: "rates", order: "name", label: "rates" },
  { name: "recipes", order: "id", label: "recipes" },
  { name: "recipe_ingredients", order: "id", label: "recipe ingredient lines" },
];
const PAGE_SIZE = 1000; // Supabase returns a limited number of rows per request, so we read in pages

const jsonBtn = document.getElementById("backup-json-btn");
const csvBtn = document.getElementById("backup-csv-btn");
const statusEl = document.getElementById("backup-status");

// Reads every row of a table, page by page, until a page comes back empty.
async function fetchAll(table, order) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select("*").order(order).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (data.length === 0) break;
    rows.push(...data);
    from += data.length;
  }
  return rows;
}

async function fetchEverything() {
  // Without a session, the database quietly returns empty lists instead of an error.
  const { data: auth } = await sb.auth.getSession();
  if (!auth.session) throw new Error("Your session has ended. Please sign in again.");

  const data = {};
  for (const t of TABLES) {
    statusEl.textContent = `Reading ${t.label}...`;
    data[t.name] = await fetchAll(t.name, t.order);
  }
  // The rates table always has two rows, so none at all means something went wrong.
  if (data.rates.length === 0) {
    throw new Error("No data came back. Your session may have ended. Reload the page and sign in again.");
  }
  return data;
}

function fileBase() {
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // 2026-10-30
  return `dhanvi-bakers-backup-${date}`;
}

function countsText(data) {
  return TABLES.map((t) => `${data[t.name].length} ${t.label}`).join(", ");
}

// ---------- JSON ----------
function buildJson(data) {
  const now = new Date();
  const counts = {};
  for (const t of TABLES) counts[t.name] = data[t.name].length;
  return JSON.stringify({
    app: "DhanVi Bakers",
    exported_at: now.toISOString(),
    exported_at_ist: formatIST(now),
    row_counts: counts,
    tables: data,
  }, null, 2);
}

async function makeJson(data) {
  return {
    blob: new Blob([buildJson(data)], { type: "application/json" }),
    filename: `${fileBase()}.json`,
  };
}

// ---------- CSV (one file per table, all inside one zip) ----------
function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Stop spreadsheet programs from running text that starts like a formula
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (/[",\r\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n"; // the BOM makes Excel read ₹ and accents correctly
}

async function makeCsvZip(data) {
  if (!window.JSZip) throw new Error("The ZIP library did not load. Reload the page and try again.");
  const zip = new window.JSZip();
  for (const t of TABLES) zip.file(`${t.name}.csv`, toCsv(data[t.name]));
  return {
    blob: await zip.generateAsync({ type: "blob" }),
    filename: `${fileBase()}.zip`,
  };
}

// ---------- Download ----------
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function runBackup(makeFile) {
  jsonBtn.disabled = csvBtn.disabled = true;
  statusEl.textContent = "Preparing backup...";
  try {
    const data = await fetchEverything();
    const { blob, filename } = await makeFile(data);
    download(blob, filename);
    statusEl.textContent = `Downloaded ${filename}: ${countsText(data)} (${formatIST(new Date())}).`;
  } catch (err) {
    statusEl.textContent = "Backup failed: " + (systemMessage(err) || err.message || String(err));
  } finally {
    jsonBtn.disabled = csvBtn.disabled = false;
  }
}

export function initBackup() {
  jsonBtn.addEventListener("click", () => runBackup(makeJson));
  csvBtn.addEventListener("click", () => runBackup(makeCsvZip));
}
