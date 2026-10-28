import { sb } from "./supabaseClient.js";
import { formatIST, addCell } from "./utils.js";

const dialog = document.getElementById("ingredient-dialog");
const form = document.getElementById("ingredient-form");
const formError = document.getElementById("form-error");

export async function loadIngredients() {
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

function friendlyError(error) {
  if (error.code === "23505") return "An ingredient with this name already exists.";
  if (error.code === "23514") return "One of the values is not allowed (check price, quantity and unit).";
  if (error.code === "23503") return "This ingredient is used in a recipe and cannot be deleted. Remove it from the recipe first, or mark it inactive.";
  return error.message;
}

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

// Attach the button and form listeners once, at start-up.
export function initIngredients() {
  document.getElementById("add-ingredient-btn").addEventListener("click", () => openIngredientForm(null));
  document.getElementById("cancel-btn").addEventListener("click", () => dialog.close());

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
}
