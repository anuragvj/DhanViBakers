import { sb } from "./supabaseClient.js";
import { formatIST, addCell } from "./utils.js";

const RATE_ORDER = ["labour", "electricity"];
const RATE_LABELS = { labour: "Labour", electricity: "Electricity" };

const rateDialog = document.getElementById("rate-dialog");
const rateForm = document.getElementById("rate-form");
const rateFormError = document.getElementById("rate-form-error");

export async function loadRates() {
  const status = document.getElementById("rates-status");
  const tbody = document.querySelector("#rates-table tbody");
  status.textContent = "Loading...";
  tbody.innerHTML = "";

  const { data, error } = await sb.from("rates").select("*");
  if (error) {
    status.textContent = "Could not load rates: " + error.message;
    return;
  }

  status.textContent = data.length ? "" : "No rates found. Run the rates SQL script.";
  // Show Labour first, then Electricity
  data.sort((a, b) => RATE_ORDER.indexOf(a.name) - RATE_ORDER.indexOf(b.name));

  for (const row of data) {
    const tr = document.createElement("tr");
    addCell(tr, RATE_LABELS[row.name] || row.name);
    addCell(tr, row.rate_per_hour);
    addCell(tr, formatIST(row.updated_at));

    const actions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openRateForm(row));
    actions.appendChild(editBtn);
    tr.appendChild(actions);

    tbody.appendChild(tr);
  }
}

function openRateForm(row) {
  rateFormError.textContent = "";
  rateForm.reset();
  document.getElementById("rate-dialog-title").textContent = `Edit rate: ${RATE_LABELS[row.name] || row.name}`;
  document.getElementById("rt-name").value = row.name;
  document.getElementById("rt-rate").value = row.rate_per_hour;
  rateDialog.showModal();
}

function rateFriendlyError(error) {
  if (error.code === "23514") return "The rate cannot be negative.";
  return error.message;
}

export function initRates() {
  document.getElementById("rate-cancel-btn").addEventListener("click", () => rateDialog.close());

  rateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    rateFormError.textContent = "";
    const saveBtn = document.getElementById("rate-save-btn");
    saveBtn.disabled = true;

    const name = document.getElementById("rt-name").value;
    const rate = Number(document.getElementById("rt-rate").value);

    const { data, error } = await sb.from("rates")
      .update({ rate_per_hour: rate })
      .eq("name", name)
      .select();
    saveBtn.disabled = false;

    if (error) {
      rateFormError.textContent = rateFriendlyError(error);
      return;
    }
    if (!data || data.length === 0) {
      rateFormError.textContent = "Nothing was saved. Reload the page and try again.";
      return;
    }
    rateDialog.close();
    loadRates();
  });
}
