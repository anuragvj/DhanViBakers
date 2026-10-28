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

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const errorEl = document.getElementById("login-error");

function showSession(session) {
  if (session) {
    document.getElementById("user-email").textContent = session.user.email;
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    loadIngredients();
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

// ---------- Ingredients list ----------
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
    const cells = [
      row.name, row.price, row.price_qty, row.unit,
      row.is_active ? "Yes" : "No", row.notes || "", formatIST(row.updated_at),
    ];
    for (const value of cells) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }

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

// ---------- Pop-up form (Add and Edit share it) ----------
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
  if (error.code === "23503") return "This ingredient is used in a recipe and cannot be deleted.";
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

// ---------- Delete ----------
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

sb.auth.onAuthStateChange((_event, session) => showSession(session));
sb.auth.getSession().then(({ data }) => showSession(data.session));
