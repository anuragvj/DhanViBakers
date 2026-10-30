import { sb } from "./supabaseClient.js";
import { addCell, systemMessage } from "./utils.js";

const linesDialog = document.getElementById("lines-dialog");
const lineForm = document.getElementById("line-form");
const lineError = document.getElementById("line-form-error");
const lineSelect = document.getElementById("l-ingredient");

let currentRecipe = null;
let currentLines = [];       // lines of the open recipe
let ingredientOptions = [];  // all ingredients, for the dropdown

// Called after any change, so the recipes table can refresh its counts.
// main.js passes it in, so this file never has to import recipes.js.
let onChange = () => {};

export async function openLinesDialog(recipe) {
  currentRecipe = recipe;
  currentLines = [];
  ingredientOptions = [];
  document.getElementById("lines-title").textContent = `Ingredients: ${recipe.name}`;
  resetLineForm();
  linesDialog.showModal();
  await loadLines();
}

async function loadLines() {
  const status = document.getElementById("lines-status");
  const tbody = document.querySelector("#lines-table tbody");
  status.textContent = "Loading...";
  tbody.innerHTML = "";

  const [linesRes, ingRes] = await Promise.all([
    sb.from("recipe_ingredients")
      .select("id, quantity, ingredient_id, ingredients(name, unit)")
      .eq("recipe_id", currentRecipe.id)
      .order("id"),
    sb.from("ingredients").select("id, name, unit, is_active").order("name"),
  ]);

  if (linesRes.error || ingRes.error) {
    status.textContent = "Could not load: " + (linesRes.error || ingRes.error).message;
    return;
  }

  currentLines = linesRes.data;
  ingredientOptions = ingRes.data;

  status.textContent = currentLines.length ? "" : "No ingredients in this recipe yet.";
  for (const line of currentLines) {
    const tr = document.createElement("tr");
    addCell(tr, line.ingredients.name);
    addCell(tr, line.quantity);
    addCell(tr, line.ingredients.unit);

    const actions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEditLine(line));
    const delBtn = document.createElement("button");
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", () => removeLine(line));
    actions.append(editBtn, delBtn);
    tr.appendChild(actions);

    tbody.appendChild(tr);
  }
  fillIngredientSelect(null);
}

// When adding: a "Select ingredient" placeholder, then the active ingredients
// not already in the recipe. When editing: just the one ingredient of that
// line (it cannot be changed), with no placeholder.
function fillIngredientSelect(editingIngredientId) {
  lineSelect.innerHTML = "";
  const usedIds = new Set(currentLines.map((l) => l.ingredient_id));
  const options = ingredientOptions.filter((i) =>
    editingIngredientId ? i.id === editingIngredientId : i.is_active && !usedIds.has(i.id)
  );

  if (!editingIngredientId) {
    const placeholder = document.createElement("option");
    placeholder.value = "";   // empty value fails the "required" check, so it cannot be saved
    placeholder.textContent = options.length ? "Select ingredient" : "No more ingredients available";
    placeholder.selected = true;
    lineSelect.appendChild(placeholder);
  }
  for (const i of options) {
    const opt = document.createElement("option");
    opt.value = i.id;
    opt.textContent = i.name;
    opt.dataset.unit = i.unit;
    lineSelect.appendChild(opt);
  }
  lineSelect.disabled = Boolean(editingIngredientId);
  updateUnitLabel();
}

function updateUnitLabel() {
  const selected = lineSelect.selectedOptions[0];
  document.getElementById("l-unit").textContent = (selected && selected.dataset.unit) || "-";
}

function resetLineForm() {
  lineError.textContent = "";
  document.getElementById("l-id").value = "";
  document.getElementById("l-quantity").value = "";
  document.getElementById("line-form-title").textContent = "Add ingredient";
  document.getElementById("line-save-btn").textContent = "Add";
  document.getElementById("line-cancel-btn").classList.add("hidden");
}

function startEditLine(line) {
  resetLineForm();
  document.getElementById("l-id").value = line.id;
  document.getElementById("line-form-title").textContent = "Edit quantity";
  document.getElementById("line-save-btn").textContent = "Update";
  document.getElementById("line-cancel-btn").classList.remove("hidden");
  fillIngredientSelect(line.ingredient_id);
  lineSelect.value = line.ingredient_id;
  updateUnitLabel();
  const qty = document.getElementById("l-quantity");
  qty.value = line.quantity;
  qty.focus();
}

function lineFriendlyError(error) {
  const system = systemMessage(error);
  if (system) return system;
  if (error.code === "23505") return "This ingredient is already in the recipe. Edit its quantity instead.";
  if (error.code === "23514") return "Quantity must be greater than 0.";
  if (error.code === "23503") return "That ingredient or recipe no longer exists. Close this window and reopen it.";
  return error.message;
}

async function removeLine(line) {
  if (!confirm(`Remove "${line.ingredients.name}" from this recipe?`)) return;
  const { data, error } = await sb.from("recipe_ingredients").delete().eq("id", line.id).select();
  if (error) {
    alert(lineFriendlyError(error));
    return;
  }
  if (!data || data.length === 0) {
    alert("Nothing was removed. It may already be gone.");
  }
  resetLineForm();
  await loadLines();
  onChange();
}

export function initRecipeLines(refreshRecipes) {
  onChange = refreshRecipes;

  lineSelect.addEventListener("change", updateUnitLabel);

  document.getElementById("line-cancel-btn").addEventListener("click", () => {
    resetLineForm();
    fillIngredientSelect(null);
  });

  document.getElementById("lines-close-btn").addEventListener("click", () => {
    linesDialog.close();
    onChange(); // refresh the ingredient counts
  });

  lineForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    lineError.textContent = "";
    const saveBtn = document.getElementById("line-save-btn");
    saveBtn.disabled = true;

    const lineId = document.getElementById("l-id").value;
    const quantity = Number(document.getElementById("l-quantity").value);

    let result;
    if (lineId) {
      result = await sb.from("recipe_ingredients").update({ quantity }).eq("id", lineId).select();
    } else {
      result = await sb.from("recipe_ingredients")
        .insert({ recipe_id: currentRecipe.id, ingredient_id: Number(lineSelect.value), quantity })
        .select();
    }
    saveBtn.disabled = false;

    if (result.error) {
      lineError.textContent = lineFriendlyError(result.error);
      return;
    }
    if (!result.data || result.data.length === 0) {
      lineError.textContent = "Nothing was saved. Close this window and try again.";
      return;
    }
    resetLineForm();
    await loadLines();
    onChange();
  });
}
