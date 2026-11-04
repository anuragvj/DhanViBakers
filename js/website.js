import { sb } from "./supabaseClient.js";
import { formatIST, addCell, systemMessage } from "./utils.js";

const SINGLE_LINE_KEYS = ["business_name", "founder_name", "phone", "email"]; // everything else can have line breaks
const CLIP = 80; // table cells show only the first part of long text

const BUCKET = "product-photos";
const PHOTO_SIZE = 900;      // photos are shrunk to this many pixels square
const MAX_PICK_MB = 15;      // refuse enormous files before reading them
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function clip(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > CLIP ? flat.slice(0, CLIP) + "…" : flat;
}

function photoUrl(path) {
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
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
  if (error.code === "23514") return "The text is too long (up to 4000 characters).";
  return error.message;
}

// =====================================================
// PRODUCTS
// =====================================================
const productDialog = document.getElementById("product-dialog");
const productForm = document.getElementById("product-form");
const productFormError = document.getElementById("product-form-error");

// Photo state of the open form
let editingPath = null;      // the photo the product has now
let pickedFile = null;       // a photo chosen in this form, not uploaded yet
let removeRequested = false; // "Remove photo" was clicked
let previewUrl = null;

const photoInput = document.getElementById("p-photo");
const previewBox = document.getElementById("p-photo-preview");
const previewImg = previewBox.querySelector("img");
const removeBtn = document.getElementById("p-photo-remove");

function refreshPhotoUi() {
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  let src = null;
  if (pickedFile) {
    previewUrl = URL.createObjectURL(pickedFile);
    src = previewUrl;
  } else if (editingPath && !removeRequested) {
    src = photoUrl(editingPath);
  }
  previewBox.classList.toggle("hidden", !src);
  if (src) previewImg.src = src;
  removeBtn.classList.toggle("hidden", !src);
  removeBtn.textContent = pickedFile ? "Clear chosen photo" : "Remove photo";
}

// Crops to a centred square, shrinks it, and returns a JPEG file ready to upload.
async function resizeToJpeg(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(PHOTO_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FAF6F0"; // cream, so transparent PNGs do not turn black
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  if (bitmap.close) bitmap.close();

  const toBlob = (q) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
  let blob = await toBlob(0.85);
  if (blob && blob.size > 900 * 1024) blob = await toBlob(0.7);
  if (!blob) throw new Error("The photo could not be prepared.");
  return blob;
}

async function removePhotoQuietly(path) {
  if (!path) return;
  await sb.storage.from(BUCKET).remove([path]); // a failure only leaves an unused file behind
}

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

    const photoTd = document.createElement("td");
    if (row.image_path) {
      const img = document.createElement("img");
      img.className = "thumb";
      img.alt = "";
      img.loading = "lazy";
      img.src = photoUrl(row.image_path);
      photoTd.appendChild(img);
    }
    tr.appendChild(photoTd);

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
  pickedFile = null;
  removeRequested = false;
  editingPath = row ? row.image_path || null : null;
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
  refreshPhotoUi();
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
  } else {
    await removePhotoQuietly(row.image_path);
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

  photoInput.addEventListener("change", () => {
    productFormError.textContent = "";
    const file = photoInput.files[0];
    if (!file) { pickedFile = null; refreshPhotoUi(); return; }
    if (!PHOTO_TYPES.includes(file.type)) {
      productFormError.textContent = "Please choose a JPEG, PNG or WebP photo.";
      photoInput.value = "";
      pickedFile = null;
    } else if (file.size > MAX_PICK_MB * 1024 * 1024) {
      productFormError.textContent = `That file is larger than ${MAX_PICK_MB} MB. Please choose a smaller one.`;
      photoInput.value = "";
      pickedFile = null;
    } else {
      pickedFile = file;
      removeRequested = false;
    }
    refreshPhotoUi();
  });

  removeBtn.addEventListener("click", () => {
    if (pickedFile) {
      pickedFile = null;
      photoInput.value = "";
    } else if (editingPath) {
      removeRequested = true;
    }
    refreshPhotoUi();
  });

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

    // Photo: upload first, so a failed upload never leaves a half-saved product
    let uploadedPath = null;
    if (pickedFile) {
      try {
        const blob = await resizeToJpeg(pickedFile);
        const path = crypto.randomUUID() + ".jpg";
        const { error: upErr } = await sb.storage.from(BUCKET).upload(path, blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000", // names never repeat, so browsers can keep photos for a year
          upsert: false,
        });
        if (upErr) throw upErr;
        uploadedPath = path;
        payload.image_path = path;
      } catch (err) {
        saveBtn.disabled = false;
        productFormError.textContent = "The photo could not be uploaded: " +
          (systemMessage(err) || "this file may not be a readable image. " + (err.message || ""));
        return;
      }
    } else if (removeRequested) {
      payload.image_path = null;
    }

    let result;
    if (id) {
      result = await sb.from("products").update(payload).eq("id", id).select();
    } else {
      result = await sb.from("products").insert(payload).select();
    }
    saveBtn.disabled = false;

    if (result.error || !result.data || result.data.length === 0) {
      if (uploadedPath) await removePhotoQuietly(uploadedPath); // do not leave an unused upload
      productFormError.textContent = result.error
        ? productFriendlyError(result.error)
        : "Nothing was saved. The product may have been removed.";
      return;
    }

    // The old photo is no longer used, so delete it
    if ((uploadedPath || removeRequested) && editingPath) await removePhotoQuietly(editingPath);

    productDialog.close();
    loadProducts();
  });
}
