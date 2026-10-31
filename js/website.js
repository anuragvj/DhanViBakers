import { sb } from "./supabaseClient.js";
import { formatIST, addCell, systemMessage } from "./utils.js";

const SINGLE_LINE_KEYS = ["business_name", "phone", "email"]; // everything else can have line breaks
const CLIP = 80; // table cells show only the first part of long text

function clip(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > CLIP ? flat.slice(0, CLIP) + "…" : flat;
}

// =====================================================
// SITE CONTENT (fixed rows: edit only)
// =====================================================
const siteDialog = document.getElementById("site-dialog");
const siteForm = document.getElementById("site-form");
const siteFormError = document.getElementById("site-form-error");

export async function loadSiteContent() {
  const status = document.getElementById("site-status");
  const tbody = document.querySelector("#site-table tbody");
  status.textContent = "Loading...";
  tbody.innerHTML = "";

  const { data, error } = await sb.from("site_content").select("*").order("sort_order");
  if (error) {
    status.textContent = "Could not load site content: " + error.message;
    return;
  }

  status.textContent = data.length ? "" : "No site content rows found. Run the Win 8 SQL script.";
  for (const row of data) {
    const tr = document.createElement("tr");
    addCell(tr, row.label);
    const valueTd = addCell(tr, row.value ? clip(row.value) : "(empty)");
    if (!row.value) valueTd.className = "muted";
    addCell(tr, formatIST(row.updated_at));

    const actions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openSiteForm(row));
    actions.appendChild(editBtn);
    tr.appendChild(actions);

    tbody.appendChild(tr);
  }
}

function openSiteForm(row) {
  siteFormError.textContent = "";
  siteForm.reset();
  document.getElementById("site-dialog-title").textContent = `Edit: ${row.label}`;
  document.getElementById("sc-key").value = row.key;
  const box = document.getElementById("sc-value");
  box.rows = SINGLE_LINE_KEYS.includes(row.key) ? 1 : 5;
  box.value = row.value;
  siteDialog.showModal();
}

function siteFriendlyError(error) {
  const system = systemMessage(error);
  if (system) return system;
  if (error.code === "23514") return "The text is too long (up to 2000 characters).";
  return error.message;
}

// =====================================================
// PRODUCTS
// =====================================================
const productDialog = document.getElementById("product-dialog");
const productForm = document.getElementById("product-form");
const productFormError = document.getElementById("product-form-error");

export async function loadProducts() {
  const status = document.getElementById("products-status");
  const tbody = document.querySelector("#products-table tbody");
  status.textContent = "Loading...";
  tbody.innerHTML = "";

  const { data, error } = await sb.from("products").select("*");
  if (error) {
    status.textContent = "Could not load products: " + error.message;
    return;
  }

  status.textContent = data.length ? "" : "No products yet.";
  data.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  for (const row of data) {
    const tr = document.createElement("tr");
    addCell(tr, row.name);
    addCell(tr, row.description ? clip(row.description) : "");
    addCell(tr, row.is_visible ? "Yes" : "No");
    addCell(tr, formatIST(row.updated_at));

    const actions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openProductForm(row));
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteProduct(row));
    actions.append(editBtn, delBtn);
    tr.appendChild(actions);

    tbody.appendChild(tr);
  }
}

function openProductForm(row) {
  productFormError.textContent = "";
  productForm.reset();
  if (row) {
    document.getElementById("product-dialog-title").textContent = "Edit product";
    document.getElementById("p-id").value = row.id;
    document.getElementById("p-name").value = row.name;
    document.getElementById("p-description").value = row.description || "";
    document.getElementById("p-visible").checked = row.is_visible;
  } else {
    document.getElementById("product-dialog-title").textContent = "Add product";
    document.getElementById("p-id").value = "";
    document.getElementById("p-visible").checked = true;
  }
  productDialog.showModal();
}

function productFriendlyError(error) {
  const system = systemMessage(error);
  if (system) return system;
  if (error.code === "23505") return "A product with this name already exists (capital letters are ignored).";
  if (error.code === "23514") return "The name must be 1 to 100 characters and the description up to 1000.";
  return error.message;
}

async function deleteProduct(row) {
  if (!confirm(`Delete "${row.name}"? This cannot be undone. To hide it from customers instead, edit it and untick "Visible on site".`)) return;
  const { data, error } = await sb.from("products").delete().eq("id", row.id).select();
  if (error) {
    alert(productFriendlyError(error));
    return;
  }
  if (!data || data.length === 0) {
    alert("Nothing was deleted. The product may already be gone.");
  }
  loadProducts();
}

// Attach the button and form listeners once, at start-up.
export function initWebsite() {
  // Site content
  document.getElementById("site-cancel-btn").addEventListener("click", () => siteDialog.close());

  siteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    siteFormError.textContent = "";
    const saveBtn = document.getElementById("site-save-btn");
    saveBtn.disabled = true;

    const key = document.getElementById("sc-key").value;
    let value = document.getElementById("sc-value").value.trim();
    if (SINGLE_LINE_KEYS.includes(key)) value = value.replace(/\s*[\r\n]+\s*/g, " ");

    const { data, error } = await sb.from("site_content").update({ value }).eq("key", key).select();
    saveBtn.disabled = false;

    if (error) {
      siteFormError.textContent = siteFriendlyError(error);
      return;
    }
    if (!data || data.length === 0) {
      siteFormError.textContent = "Nothing was saved. Reload the page and try again.";
      return;
    }
    siteDialog.close();
    loadSiteContent();
  });

  // Products
  document.getElementById("add-product-btn").addEventListener("click", () => openProductForm(null));
  document.getElementById("product-cancel-btn").addEventListener("click", () => productDialog.close());

  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    productFormError.textContent = "";
    const saveBtn = document.getElementById("product-save-btn");
    saveBtn.disabled = true;

    const id = document.getElementById("p-id").value;
    const payload = {
      name: document.getElementById("p-name").value.trim(),
      description: document.getElementById("p-description").value.trim() || null,
      is_visible: document.getElementById("p-visible").checked,
    };

    let result;
    if (id) {
      result = await sb.from("products").update(payload).eq("id", id).select();
    } else {
      result = await sb.from("products").insert(payload).select();
    }
    saveBtn.disabled = false;

    if (result.error) {
      productFormError.textContent = productFriendlyError(result.error);
      return;
    }
    if (!result.data || result.data.length === 0) {
      productFormError.textContent = "Nothing was saved. The product may have been removed.";
      return;
    }
    productDialog.close();
    loadProducts();
  });
}
