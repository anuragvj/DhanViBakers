import { sb } from "./supabaseClient.js";
import { addCell } from "./utils.js";

// Estimated end weight = raw weight (g ingredients) x this number.
// Change it here if your usual yield changes.
const ESTIMATED_YIELD = 0.93;
const YIELD_PERCENT = Math.round(ESTIMATED_YIELD * 100);

const moneyFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const perGramFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const weightFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const rupees = (n) => "₹ " + moneyFmt.format(n);
const rupeesPerGram = (n) => "₹ " + perGramFmt.format(n);

const select = document.getElementById("cost-recipe");
const statusEl = document.getElementById("cost-status");
const resultEl = document.getElementById("cost-result");
const orderForm = document.getElementById("order-form");
const orderResult = document.getElementById("order-result");

let current = null; // cost per gram figures of the selected recipe, used by the order calculator
let requestId = 0;  // lets us ignore a slow response from an earlier selection

function clearResult() {
  current = null;
  resultEl.classList.add("hidden");
  orderResult.innerHTML = "";
  statusEl.textContent = "";
}

// Rebuilds the recipe dropdown and keeps the selection if it still exists.
export async function loadRecipeCost() {
  const previous = select.value;
  const { data, error } = await sb.from("recipes").select("id, name").order("name");
  if (error) {
    statusEl.textContent = "Could not load recipes: " + error.message;
    return;
  }

  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = data.length ? "Select recipe" : "No recipes yet";
  select.appendChild(placeholder);
  for (const recipe of data) {
    const opt = document.createElement("option");
    opt.value = recipe.id;
    opt.textContent = recipe.name;
    select.appendChild(opt);
  }

  if (previous && data.some((r) => String(r.id) === previous)) {
    select.value = previous;
    await showRecipe(previous);
  } else {
    clearResult();
  }
}

async function showRecipe(id) {
  if (!id) {
    clearResult();
    return;
  }
  const myRequest = ++requestId;
  statusEl.textContent = "Loading...";

  const [sumRes, linesRes] = await Promise.all([
    sb.from("recipe_cost_summary").select("*").eq("recipe_id", id).maybeSingle(),
    sb.from("recipe_line_costs").select("*").eq("recipe_id", id).order("line_id"),
  ]);
  if (myRequest !== requestId) return; // a newer selection took over

  if (sumRes.error || linesRes.error) {
    statusEl.textContent = "Could not load: " + (sumRes.error || linesRes.error).message;
    resultEl.classList.add("hidden");
    return;
  }
  if (!sumRes.data) {
    statusEl.textContent = "This recipe no longer exists.";
    resultEl.classList.add("hidden");
    return;
  }
  render(sumRes.data, linesRes.data);
}

function addRow(tbody, label, value, strong) {
  const tr = document.createElement("tr");
  addCell(tr, label);
  addCell(tr, value).className = "num";
  if (strong) tr.className = "total-row";
  tbody.appendChild(tr);
}

function fillStats(statsId, noteId, rows, note) {
  const dl = document.getElementById(statsId);
  dl.innerHTML = "";
  for (const [label, value, strong] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    if (strong) dt.className = dd.className = "strong";
    dl.append(dt, dd);
  }
  document.getElementById(noteId).textContent = note || "";
}

function render(s, lines) {
  const total = Number(s.total_cost);
  const productQty = Number(s.product_qty_g);
  const rawWeight = Number(s.raw_weight_g);
  const estWeight = rawWeight * ESTIMATED_YIELD;
  const actualPerGram = productQty > 0 ? total / productQty : null;
  const estPerGram = estWeight > 0 ? total / estWeight : null;
  current = { actualPerGram, estPerGram };

  statusEl.textContent = lines.length ? "" : "No ingredients in this recipe yet.";
  orderResult.innerHTML = "";

  // 1. Ingredients
  const linesBody = document.querySelector("#cost-lines-table tbody");
  linesBody.innerHTML = "";
  for (const line of lines) {
    const tr = document.createElement("tr");
    addCell(tr, line.ingredient_name + (line.is_active ? "" : " (inactive)"));
    addCell(tr, weightFmt.format(Number(line.quantity))).className = "num";
    addCell(tr, line.unit);
    addCell(tr, moneyFmt.format(Number(line.line_cost))).className = "num";
    linesBody.appendChild(tr);
  }
  document.getElementById("cost-ingredient-total").textContent = rupees(Number(s.ingredient_cost));
  document.getElementById("cost-raw-weight").textContent = weightFmt.format(rawWeight) + " g";
  const nonGram = Number(s.non_gram_lines);
  document.getElementById("cost-raw-note").textContent = nonGram > 0
    ? `Weight counts g ingredients only. ${nonGram} ml or piece ingredient(s) are in the cost but not in this weight.`
    : "";

  // 2. Cost breakdown
  const breakdown = document.querySelector("#cost-breakdown-table tbody");
  breakdown.innerHTML = "";
  addRow(breakdown, "Ingredients", rupees(Number(s.ingredient_cost)));
  addRow(breakdown, `Labour (₹ ${moneyFmt.format(Number(s.labour_rate))}/hr × ${weightFmt.format(Number(s.labour_min))} min)`, rupees(Number(s.labour_cost)));
  addRow(breakdown, `Electricity (₹ ${moneyFmt.format(Number(s.electricity_rate))}/hr × ${weightFmt.format(Number(s.electricity_min))} min)`, rupees(Number(s.electricity_cost)));
  addRow(breakdown, "Other cost", rupees(Number(s.other_cost)));
  addRow(breakdown, "Total cost", rupees(total), true);

  // Subtle warning, only when a zero rate actually affects this recipe
  const warnings = [];
  if (Number(s.labour_rate) === 0 && Number(s.labour_min) > 0) warnings.push("Labour rate is 0");
  if (Number(s.electricity_rate) === 0 && Number(s.electricity_min) > 0) warnings.push("Electricity rate is 0");
  document.getElementById("cost-rate-warning").textContent = warnings.length
    ? warnings.join(". ") + ". Set it under Setup, Rates, or the total will be too low."
    : "";

  // 3. Insights
  fillStats("cost-actual-stats", "cost-actual-note", [
    ["Weight (from recipe)", productQty > 0 ? weightFmt.format(productQty) + " g" : "Not set"],
    ["Total cost", rupees(total)],
    ["Cost per gram", actualPerGram === null ? "-" : rupeesPerGram(actualPerGram), true],
  ], actualPerGram === null ? "Set the product quantity on the recipe to see cost per gram." : "");

  let estNote = "";
  if (rawWeight === 0) estNote = "No gram ingredients in this recipe, so the weight cannot be estimated.";
  else if (nonGram > 0) estNote = "Raw weight counts g ingredients only.";
  fillStats("cost-est-stats", "cost-est-note", [
    ["Raw weight (g ingredients)", weightFmt.format(rawWeight) + " g"],
    [`Estimated end weight (× ${YIELD_PERCENT}%)`, weightFmt.format(estWeight) + " g"],
    ["Total cost", rupees(total)],
    ["Cost per estimated gram", estPerGram === null ? "-" : rupeesPerGram(estPerGram), true],
  ], estNote);

  resultEl.classList.remove("hidden");
}

// 4. Cost for an order
function renderOrder() {
  orderResult.innerHTML = "";
  if (!current) return;

  const grams = Number(document.getElementById("order-grams").value);
  const addLine = (text) => {
    const p = document.createElement("p");
    p.textContent = text;
    orderResult.appendChild(p);
  };
  if (!(grams > 0)) {
    addLine("Enter a quantity above 0.");
    return;
  }

  const options = [
    ["Based on actual end product", current.actualPerGram, "set the product quantity on the recipe to use this."],
    [`Based on estimated end weight (${YIELD_PERCENT}%)`, current.estPerGram, "this recipe has no gram ingredients to estimate from."],
  ];
  for (const [label, perGram, missing] of options) {
    if (perGram === null) addLine(`${label}: ${missing}`);
    else addLine(`${label}: ${rupeesPerGram(perGram)} per g × ${weightFmt.format(grams)} g = ${rupees(perGram * grams)}`);
  }
}

export function initRecipeCost() {
  select.addEventListener("change", () => {
    orderResult.innerHTML = "";
    showRecipe(select.value);
  });
  orderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderOrder();
  });
}
