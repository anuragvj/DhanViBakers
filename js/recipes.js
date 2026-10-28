import { sb } from "./supabaseClient.js";
import { formatIST, addCell } from "./utils.js";
import { openLinesDialog } from "./recipeLines.js";

const recipeDialog = document.getElementById("recipe-dialog");
const recipeForm = document.getElementById("recipe-form");
const recipeFormError = document.getElementById("recipe-form-error");

export async function loadRecipes() {
  const status = document.getElementById("recipes-status");
  const tbody = document.querySelector("#recipes-table tbody");
  status.textContent = "Loading...";
  tbody.innerHTML = "";

  // "recipe_ingredients(count)" also returns how many lines each recipe has.
  const { data, error } = await sb.from("recipes").select("*, recipe_ingredients(count)").order("id");
  if (error) {
    status.textContent = "Could not load recipes: " + error.message;
    return;
  }

  status.textContent = data.length ? "" : "No recipes yet.";
  for (const row of data) {
    const count = row.recipe_ingredients?.[0]?.count ?? 0;
    const tr = document.createElement("tr");
    addCell(tr, row.name);
    addCell(tr, row.labour_min);
    addCell(tr, row.electricity_min);
    addCell(tr, row.product_qty_g);
    addCell(tr, row.other_cost);

    const ingTd = document.createElement("td");
    const ingBtn = document.createElement("button");
    ingBtn.textContent = `Ingredients (${count})`;
    ingBtn.addEventListener("click", () => openLinesDialog(row));
    ingTd.appendChild(ingBtn);
    tr.appendChild(ingTd);

    addCell(tr, row.notes || "");
    addCell(tr, formatIST(row.updated_at));

    const actions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openRecipeForm(row));
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteRecipe(row));
    actions.append(editBtn, delBtn);
    tr.appendChild(actions);

    tbody.appendChild(tr);
  }
}

function openRecipeForm(row) {
  recipeFormError.textContent = "";
  recipeForm.reset(); // numeric fields go back to 0
  if (row) {
    document.getElementById("recipe-dialog-title").textContent = "Edit recipe";
    document.getElementById("r-id").value = row.id;
    document.getElementById("r-name").value = row.name;
    document.getElementById("r-labour").value = row.labour_min;
    document.getElementById("r-electricity").value = row.electricity_min;
    document.getElementById("r-product-qty").value = row.product_qty_g;
    document.getElementById("r-other-cost").value = row.other_cost;
    document.getElementById("r-notes").value = row.notes || "";
  } else {
    document.getElementById("recipe-dialog-title").textContent = "Add recipe";
    document.getElementById("r-id").value = "";
  }
  recipeDialog.showModal();
}

function recipeFriendlyError(error) {
  if (error.code === "23505") return "A recipe with this name already exists.";
  if (error.code === "23514") return "Minutes, product quantity and other cost cannot be negative.";
  return error.message;
}

async function deleteRecipe(row) {
  if (!confirm(`Delete "${row.name}" and its ingredient list? This cannot be undone.`)) return;
  const { data, error } = await sb.from("recipes").delete().eq("id", row.id).select();
  if (error) {
    alert(recipeFriendlyError(error));
    return;
  }
  if (!data || data.length === 0) {
    alert("Nothing was deleted. The recipe may already be gone.");
  }
  loadRecipes();
}

export function initRecipes() {
  document.getElementById("add-recipe-btn").addEventListener("click", () => openRecipeForm(null));
  document.getElementById("recipe-cancel-btn").addEventListener("click", () => recipeDialog.close());

  recipeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    recipeFormError.textContent = "";
    const saveBtn = document.getElementById("recipe-save-btn");
    saveBtn.disabled = true;

    const id = document.getElementById("r-id").value;
    const payload = {
      name: document.getElementById("r-name").value.trim(),
      labour_min: Number(document.getElementById("r-labour").value),
      electricity_min: Number(document.getElementById("r-electricity").value),
      product_qty_g: Number(document.getElementById("r-product-qty").value),
      other_cost: Number(document.getElementById("r-other-cost").value),
      notes: document.getElementById("r-notes").value.trim() || null,
    };

    let result;
    if (id) {
      result = await sb.from("recipes").update(payload).eq("id", id).select();
    } else {
      result = await sb.from("recipes").insert(payload).select();
    }
    saveBtn.disabled = false;

    if (result.error) {
      recipeFormError.textContent = recipeFriendlyError(result.error);
      return;
    }
    if (!result.data || result.data.length === 0) {
      recipeFormError.textContent = "Nothing was saved. The recipe may have been removed.";
      return;
    }
    recipeDialog.close();
    loadRecipes();
  });
}
