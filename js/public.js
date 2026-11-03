import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

// Visitor-only connection: never saves or reads a login (own storage key, so it never mixes with admin).
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "dhanvi-public" },
});
const $ = (id) => document.getElementById(id);
const SINGLE_NUMBER = /^\+?\d[\d\s().-]{4,}$/;
const EMAIL = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/;

function show(el, text) { el.textContent = text; el.classList.toggle("hidden", !text); }
function setSection(id, visible) {
  $(id).classList.toggle("hidden", !visible);
  document.querySelector(`.top nav a[href="#${id}"]`).classList.toggle("hidden", !visible);
}

// ---------- Carousel ----------
let index = 0, count = 0;
function go(i) {
  if (!count) return;
  index = (i + count) % count; // wraps around at both ends
  $("slides").style.transform = `translateX(-${index * 100}%)`;
  document.querySelectorAll(".slide").forEach((s, n) => s.setAttribute("aria-hidden", n !== index));
  document.querySelectorAll(".dot").forEach((d, n) => d.classList.toggle("on", n === index));
  $("counter").textContent = `${index + 1} of ${count}`;
}

function buildCarousel(products) {
  const slides = $("slides"), dots = $("dots");
  slides.innerHTML = dots.innerHTML = "";
  count = products.length;
  products.forEach((p, n) => {
    const slide = document.createElement("article");
    slide.className = "slide";
    const photo = document.createElement("div"); // the photo goes here later; for now a letter tile
    photo.className = "photo";
    photo.setAttribute("aria-hidden", "true");
    photo.textContent = p.name.trim().charAt(0).toUpperCase();
    const text = document.createElement("div");
    text.className = "text";
    const title = document.createElement("h3");
    title.textContent = p.name;
    text.appendChild(title);
    if (p.description) {
      const d = document.createElement("p");
      d.textContent = p.description;
      text.appendChild(d);
    }
    slide.append(photo, text);
    slides.appendChild(slide);

    const dot = document.createElement("button");
    dot.className = "dot";
    dot.setAttribute("aria-label", "Show " + p.name);
    dot.addEventListener("click", () => go(n));
    dots.appendChild(dot);
  });
  $("products").classList.toggle("single", count < 2);
  go(0);
}

const car = $("carousel");
$("prev").addEventListener("click", () => go(index - 1));
$("next").addEventListener("click", () => go(index + 1));
car.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") go(index - 1);
  if (e.key === "ArrowRight") go(index + 1);
});
let x0 = null;
car.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
car.addEventListener("touchend", (e) => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  x0 = null;
  if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
});

// ---------- Highlight the current section in the header ----------
const links = [...document.querySelectorAll(".top nav a")];
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.hash === "#" + e.target.id));
}), { rootMargin: "-40% 0px -55% 0px" });
["products", "about", "contact"].forEach((id) => io.observe($(id)));

// ---------- Admin login popup ----------
const dlg = $("login-dialog"), form = $("login-form"), err = $("login-error");
let auth = null; // the admin connection is only loaded when someone clicks Admin

async function openAdmin() {
  try {
    auth = await import("./supabaseClient.js");
    const { data } = await auth.sb.auth.getSession();
    if (data.session) { location.href = "admin.html"; return; } // already signed in
  } catch {
    location.href = "admin.html"; // could not load: the admin page has its own login
    return;
  }
  err.textContent = "";
  form.reset();
  dlg.showModal();
}
document.querySelectorAll(".js-admin").forEach((b) => b.addEventListener("click", openAdmin));
$("login-cancel").addEventListener("click", () => dlg.close());
dlg.addEventListener("close", () => { $("login-pass").value = ""; });
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  err.textContent = "";
  const btn = $("login-submit");
  btn.disabled = true;
  auth.setRemember($("login-remember").checked); // must be set before signing in
  const { error } = await auth.sb.auth.signInWithPassword({
    email: $("login-email").value.trim(), password: $("login-pass").value,
  });
  btn.disabled = false;
  if (error) { err.textContent = "Sign-in failed. Check your details and connection, then try again."; return; }
  location.href = "admin.html";
});

// ---------- Load the page content ----------
async function load() {
  let c, p;
  try {
    [c, p] = await Promise.all([
      sb.from("site_content").select("key, value"),
      sb.from("products").select("name, description").eq("is_visible", true),
    ]);
  } catch { c = p = { error: true }; }

  const v = {};
  if (!c.error) for (const r of c.data) v[r.key] = (r.value || "").trim();
  const name = v.business_name || "DhanVi Bakers";
  $("site-name").textContent = $("brand").textContent = document.title = name;
  show($("tagline"), v.site_description || "");

  show($("about-text"), v.about_us || "");
  show($("founder"), v.founder_name ? "— " + v.founder_name : "");
  setSection("about", Boolean(v.about_us || v.founder_name));

  let n = 0;
  if (!p.error) {
    const items = p.data.slice().sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    n = items.length;
    buildCarousel(items);
  }
  setSection("products", n > 0);

  const box = $("contact-details");
  box.innerHTML = "";
  const line = (t) => { const q = document.createElement("p"); q.textContent = t; box.appendChild(q); };
  if (v.contact_note) line(v.contact_note);
  if (v.contact_hours) line(v.contact_hours);
  if (v.phone) line("Phone: " + v.phone);
  if (v.email) line("Email: " + v.email);
  const callOk = SINGLE_NUMBER.test(v.phone || ""), mailOk = EMAIL.test(v.email || "");
  $("call-btn").classList.toggle("hidden", !callOk);
  if (callOk) $("call-btn").href = "tel:" + v.phone.replace(/[^\d+]/g, "");
  $("mail-btn").classList.toggle("hidden", !mailOk);
  if (mailOk) $("mail-btn").href = "mailto:" + v.email;
  setSection("contact", box.children.length > 0);

  if (c.error || p.error) show($("site-status"), "We couldn't load everything right now. Please try again in a little while.");
  else if (n === 0) show($("site-status"), "Our menu is being updated. Please contact us.");
  else show($("site-status"), "");
}
load();
