import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const DEFAULT_NAME = "DhanVi Bakers";

// This page always acts as a visitor: it never saves or reads a login,
// so even if you are signed in to admin in this browser, you see what customers see.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const nameEl = document.getElementById("site-name");
const descEl = document.getElementById("site-description");
const statusEl = document.getElementById("site-status");
const productsSection = document.getElementById("products-section");
const productList = document.getElementById("product-list");
const contactSection = document.getElementById("contact-section");
const contactDetails = document.getElementById("contact-details");

// A phone number becomes a tap-to-call link only if it looks like a single number.
const SINGLE_NUMBER = /^\+?\d[\d\s().-]{4,}$/;
const EMAIL = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/;

// Shows text in an element, or hides the element when the text is empty.
function show(el, text) {
  el.textContent = text;
  el.classList.toggle("hidden", !text);
}

function detailLine(label, value, href) {
  const p = document.createElement("p");
  if (label) p.append(label + " ");
  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = value;
    p.append(a);
  } else {
    p.append(value);
  }
  contactDetails.appendChild(p);
}

async function load() {
  let contentRes, productsRes;
  try {
    [contentRes, productsRes] = await Promise.all([
      sb.from("site_content").select("key, value"),
      sb.from("products").select("name, description").eq("is_visible", true),
    ]);
  } catch {
    contentRes = productsRes = { error: true };
  }

  // ----- Site content -----
  const content = {};
  if (!contentRes.error) {
    for (const row of contentRes.data) content[row.key] = (row.value || "").trim();
  }
  const siteName = content.business_name || DEFAULT_NAME;
  nameEl.textContent = siteName;
  document.title = siteName;
  show(descEl, content.site_description || "");

  // ----- Products -----
  let productCount = 0;
  if (!productsRes.error) {
    const products = productsRes.data.slice()
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    productCount = products.length;
    productList.innerHTML = "";
    for (const product of products) {
      const item = document.createElement("article");
      item.className = "product";
      const title = document.createElement("h3");
      title.textContent = product.name;
      item.appendChild(title);
      if (product.description) {
        const text = document.createElement("p");
        text.textContent = product.description;
        item.appendChild(text);
      }
      productList.appendChild(item);
    }
    productsSection.classList.toggle("hidden", productCount === 0);
  }

  // ----- Contact -----
  contactDetails.innerHTML = "";
  if (!contentRes.error) {
    if (content.contact_note) detailLine("", content.contact_note);
    if (content.contact_hours) detailLine("", content.contact_hours);
    if (content.phone) {
      const href = SINGLE_NUMBER.test(content.phone) ? "tel:" + content.phone.replace(/[^\d+]/g, "") : null;
      detailLine("Phone:", content.phone, href);
    }
    if (content.email) {
      detailLine("Email:", content.email, EMAIL.test(content.email) ? "mailto:" + content.email : null);
    }
  }
  contactSection.classList.toggle("hidden", contactDetails.children.length === 0);

  // ----- Status message -----
  if (contentRes.error || productsRes.error) {
    show(statusEl, "We couldn't load everything right now. Please try again in a little while.");
  } else if (productCount === 0) {
    show(statusEl, "Our menu is being updated. Please contact us.");
  } else {
    show(statusEl, "");
  }
}

load();
