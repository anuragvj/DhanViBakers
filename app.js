// Paste your own values between the quotes.
const SUPABASE_URL = "https://icffxjvysfjlyxncogrn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Sm2-5Dx5jJx828mnyI8N0A_W9Ndv01z";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// All dates in the app are shown in Indian Standard Time.
function formatIST(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) + " IST";
}

// Small helper: add a text cell to a table row.
function addCell(tr, text) {
  const td = document.createElement("td");
  td.textContent = text;
  tr.appendChild(td);
  return td;
}

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const errorEl = document.getElementById("login-error");

function showSession(session) {
  if (session) {
    document.getElementById("user-email").textContent = session.user.email;
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    loadIngredients();
    loadRecipes();
  } else {
    appView.classList.add("hidden");
    loginView.classList.remove("hidden");
  }
}

// ---------- Login / logout ----------
document.getElementById("login-btn").addEventListener("click", async () => {
  errorEl.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) errorEl.textContent = "Login failed: " + error.message;
});

document.getElementById("logout-btn").addEventListener("click", () => sb.auth.signOut());

// =====================================================
// INGREDIENTS
// =====================================================
async function loadIngredients() {
  const status = document.getElementById("ingredients-status");
  const tbody = document.querySelector("#ingredients-table tbody");
  status.textContent = "Loading...";
  tbody.innerHTML = "";

  const { data, error } = await sb.from("ingredients").select("*").order("id");
  if (error) {
    status.textContent = "Could not load ingredients: " + error.message;
    return;
  }

  status.textContent = data.length ? "" : "No ingredients yet.";
  for (const row of data) {
    const tr = document.createElement("tr");
    addCell(tr, row.name);
    addCell(tr, row.price);
    addCell(tr, row.price_qty);
    addCell(tr, row.unit);
    addCell(tr, row.is_active ? "Yes" : "No");
    addCell(tr, row.notes || "");
    addCell(tr, formatIST(row.updated_at));

    const actions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openIngredientForm(row));
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteIngredient(row));
    actions.append(editBtn, delBtn);
    tr.appendChild(actions);

    tbody.appendChild(tr);
  }
}

const dialog = document.getElementById("ingredient-dialog");
const form = document.getElementById("ingredient-form");
const formError = document.getElementById("form-error");

function openIngredientForm(row) {
  formError.textContent = "";
  form.reset();
  if (row) {
    document.getElementById("dialog-title").textContent = "Edit ingredient";
    document.getElementById("f-id").value = row.id;
    document.getElementById("f-name").value = row.name;
    document.getElementById("f-price").value = row.price;
    document.getElementById("f-price-qty").value = row.price_qty;
    document.getElementById("f-unit").value = row.unit;
    document.getElementById("f-notes").value = row.notes || "";
    document.getElementById("f-active").checked = row.is_active;
  } else {
    document.getElementById("dialog-title").textContent = "Add ingredient";
    document.getElementById("f-id").value = "";
    document.getElementById("f-active").checked = true;
  }
  dialog.showModal();
}

document.getElementById("add-ingredient-btn").addEventListener("click", () => openIngredientForm(null));
document.getElementById("cancel-btn").addEventListener("click", () => dialog.close());

function friendlyError(error) {
  if (error.code === "23505") return "An ingredient with this name already exists.";
  if (error.code === "23514") return "One of the values is not allowed (check price, quantity and unit).";
  if (error.code === "23503") return "This ingredient is used in a recipe and cannot be deleted. Remove it from the recipe first, or mark it inactive.";
  return error.message;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";
  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;

  const id = document.getElementById("f-id").value;
  const payload = {
    name: document.getElementById("f-name").value.trim(),
    price: Number(document.getElementById("f-price").value),
    price_qty: Number(document.getElementById("f-price-qty").value),
    unit: document.getElementById("f-unit").value,
    notes: document.getElementById("f-notes").value.trim() || null,
    is_active: document.getElementById("f-active").checked,
  };

  let result;
  if (id) {
    result = await sb.from("ingredients").update(payload).eq("id", id).select();
  } else {
    result = await sb.from("ingredients").insert(payload).select();
  }
  saveBtn.disabled = false;

  if (result.error) {
    formError.textContent = friendlyError(result.error);
    return;
  }
  if (!result.data || result.data.length === 0) {
    formError.textContent = "Nothing was saved. The ingredient may have been removed.";
    return;
  }
  dialog.close();
  loadIngredients();
});

async function deleteIngredient(row) {
  if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
  const { data, error } = await sb.from("ingredients").delete().eq("id", row.id).select();
  if (error) {
    alert(friendlyError(error));
    return;
  }
  if (!data || data.length === 0) {
    alert("Nothing was deleted. The ingredient may already be gone.");
  }
  loadIngredients();
}

// =====================================================
// RECIPES
// =====================================================
async function loadRecipes() {
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

const recipeDialog = document.getElementById("recipe-dialog");
const recipeForm = document.getElementById("recipe-form");
const recipeFormError = document.getElementById("recipe-form-error");

function openRecipeForm(row) {
  recipeFormError.textContent = "";
  recipeForm.reset(); // minutes go back to 0
  if (row) {
    document.getElementById("recipe-dialog-title").textContent = "Edit recipe";
    document.getElementById("r-id").value = row.id;
    document.getElementById("r-name").value = row.name;
    document.getElementById("r-labour").value = row.labour_min;
    document.getElementById("r-electricity").value = row.electricity_min;
    document.getElementById("r-notes").value = row.notes || "";
  } else {
    document.getElementById("recipe-dialog-title").textContent = "Add recipe";
    document.getElementById("r-id").value = "";
  }
  recipeDialog.showModal();
}

document.getElementById("add-recipe-btn").addEventListener("click", () => openRecipeForm(null));
document.getElementById("recipe-cancel-btn").addEventListener("click", () => recipeDialog.close());

function recipeFriendlyError(error) {
  if (error.code === "23505") return "A recipe with this name already exists.";
  if (error.code === "23514") return "Minutes cannot be negative.";
  return error.message;
}

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

// =====================================================
// RECIPE INGREDIENTS (the pop-up opened from a recipe row)
// =====================================================
const linesDialog = document.getElementById("lines-dialog");
const lineForm = document.getElementById("line-form");
const lineError = document.getElementById("line-form-error");
const lineSelect = document.getElementById("l-ingredient");

let currentRecipe = null;
let currentLines = [];       // lines of the open recipe
let ingredientOptions = [];  // all ingredients, for the dropdown

async function openLinesDialog(recipe) {
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

// When adding: active ingredients not already in the recipe.
// When editing: just the one ingredient of that line (it cannot be changed).
function fillIngredientSelect(editingIngredientId) {
  lineSelect.innerHTML = "";
  const usedIds = new Set(currentLines.map((l) => l.ingredient_id));
  const options = ingredientOptions.filter((i) =>
    editingIngredientId ? i.id === editingIngredientId : i.is_active && !usedIds.has(i.id)
  );

  if (options.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No more ingredients available";
    lineSelect.appendChild(opt);
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
lineSelect.addEventListener("change", updateUnitLabel);

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

document.getElementById("line-cancel-btn").addEventListener("click", () => {
  resetLineForm();
  fillIngredientSelect(null);
});

document.getElementById("lines-close-btn").addEventListener("click", () => {
  linesDialog.close();
  loadRecipes(); // refresh the ingredient counts
});

function lineFriendlyError(error) {
  if (error.code === "23505") return "This ingredient is already in the recipe. Edit its quantity instead.";
  if (error.code === "23514") return "Quantity must be greater than 0.";
  if (error.code === "23503") return "That ingredient or recipe no longer exists. Close this window and reopen it.";
  return error.message;
}

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
  loadRecipes();
});

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
  loadRecipes();
}

sb.auth.onAuthStateChange((_event, session) => showSession(session));
sb.auth.getSession().then(({ data }) => showSession(data.session));
