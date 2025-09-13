/* roof-widget/roof-widget.js */
/* Instant Roofing Estimate Widget — size presets + modal + brand color detection + alignment fix */

(function () {
  // ============== Read config from <script> tag ==============
  const me = document.currentScript;
  const cfg = {
    client: (me?.dataset?.client || "demo").trim(),
    variant: (me?.dataset?.variant || "full").toLowerCase(),     // "full" | "compact" | "ultra" | "modal"
    theme: (me?.dataset?.theme || "light").toLowerCase(),        // "light" | "dark"
    width: me?.dataset?.width || "100%",                         // e.g., "360px", "520px", "100%"
    primaryOverride: me?.dataset?.primary || "",                 // manual override; else auto-detect
    modalButton: (me?.dataset?.modalButton || "").toLowerCase()  // "auto" to render a floating CTA
  };

  // ============== Brand color detector ==============
  function toHex(n) {
    const h = Number(n).toString(16).padStart(2, "0");
    return h.length > 2 ? "ff" : h;
  }
  function rgbToHex(rgb) {
    const m = rgb.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?\)/i);
    if (!m) return null;
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
  }
  function pickFirstColor(candidates) {
    for (const c of candidates) {
      if (!c) continue;
      if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return c;
      if (c.startsWith("rgb")) {
        const hx = rgbToHex(c);
        if (hx) return hx;
      }
    }
    return null;
  }
  function detectBrandColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const fromMeta = meta?.getAttribute("content")?.trim();
    const root = getComputedStyle(document.documentElement);
    const fromVars = [
      root.getPropertyValue("--color-primary"),
      root.getPropertyValue("--primary"),
      root.getPropertyValue("--brand"),
      root.getPropertyValue("--accent"),
    ].map(v => v && v.trim()).filter(Boolean);
    const btns = Array.from(document.querySelectorAll("button, .button, .btn, a, [class*='primary']")).slice(0, 20);
    const bgColors = btns.map(el => getComputedStyle(el).backgroundColor).filter(c => c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)");
    const fgColors = btns.map(el => getComputedStyle(el).color).filter(Boolean);
    const header = document.querySelector("header") || document.querySelector(".site-header") || document.querySelector(".navbar");
    const fromHeader = header ? getComputedStyle(header).backgroundColor : "";
    return pickFirstColor([cfg.primaryOverride, fromMeta, ...fromVars, ...bgColors, fromHeader, ...fgColors]) || "#0f172a";
  }
  const PRIMARY = detectBrandColor();

  // ============== Inject styles (scoped) ==============
  const css = `
  .rw{--rw-radius:14px;--rw-gap:14px;--rw-border:#e5e7eb;--rw-bg:#fff;--rw-text:#111827;--rw-muted:#6b7280;--rw-primary:${PRIMARY};font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:var(--rw-text);background:var(--rw-bg);border:1px solid var(--rw-border);border-radius:var(--rw-radius);padding:16px;box-shadow:0 2px 16px rgba(0,0,0,.06);max-width:${cfg.width}}
  .rw--dark{--rw-border:#374151;--rw-bg:#111827;--rw-text:#f9fafb;--rw-muted:#9ca3af}
  .rw h2{margin:0 0 10px;font-size:20px}
  .rw form .grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--rw-gap)}
  @media (max-width:640px){.rw form .grid{grid-template-columns:1fr}}
  .rw label{font-size:12px;color:var(--rw-muted);display:block}
  .rw .row{display:contents}
  .rw input,.rw select{width:100%;border:1px solid var(--rw-border);border-radius:10px;padding:10px 12px;background:transparent;color:inherit}
  .rw .hint{font-size:12px;color:var(--rw-muted);margin:4px 0 10px}
  .rw .actions{text-align:right;margin-top:8px}
  .rw button{border:1px solid var(--rw-primary);background:var(--rw-primary);color:#fff;border-radius:12px;padding:10px 14px;cursor:pointer;font-weight:600}
  /* compact */
  .rw--compact{padding:12px}
  .rw--compact h2{font-size:18px;margin-bottom:8px}
  .rw--compact form .grid{grid-template-columns:1fr 1fr;gap:10px}
  .rw--compact input,.rw--compact select{padding:8px 10px;border-radius:8px}
  @media (max-width:520px){.rw--compact form .grid{grid-template-columns:1fr}}
  /* ultra */
  .rw--ultra{padding:10px}
  .rw--ultra h2{font-size:16px;margin-bottom:6px}
  .rw--ultra form .grid{grid-template-columns:1fr;gap:8px}
  .rw--ultra label{display:none}
  .rw--ultra input::placeholder,.rw--ultra select{font-size:14px}
  .rw--ultra .hint{display:none}
  .rw--ultra .actions{margin-top:6px}
  /* error */
  .rw .error{display:none;margin:8px 0 0;color:#dc2626;font-size:13px}
  /* modal shell */
  .rw-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:.15s;z-index:999998}
  .rw-modal{position:fixed;inset:0;display:grid;place-items:center;opacity:0;pointer-events:none;transition:.15s;z-index:999999}
  .rw-modal.open,.rw-backdrop.open{opacity:1;pointer-events:auto}
  .rw-card{width:min(96vw,560px);max-height:90vh;overflow:auto;border-radius:14px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 10px 30px rgba(0,0,0,.18)}
  .rw-dark .rw-card{background:#111827;border-color:#374151}
  .rw-close{position:absolute;top:10px;right:10px;border:none;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#6b7280}
  .rw-fab{position:fixed;right:18px;bottom:18px;border:0;border-radius:999px;padding:12px 16px;background:var(--rw-primary,#0f172a);color:#fff;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.2);cursor:pointer;z-index:999997}
  @media (max-width:420px){.rw-fab{left:18px;right:18px;width:auto}}
  @supports not (display: contents) { .rw form .grid{grid-template-columns:1fr} } /* graceful fallback */
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ============== Utilities ==============
  const $ = (sel, el) => (el || document).querySelector(sel);
  const val = (sel, el) => ($(sel, el)?.value || "").trim();

  function toE164US(p) {
    if (!p) return null;
    const s = String(p).trim();
    if (s.startsWith("+") && /^\+\d{10,15}$/.test(s)) return s;
    const digits = s.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
    if (digits.length === 10) return "+1" + digits;
    return null;
  }

  // ============== Build the form ==============
  function buildForm() {
    const sizeClass =
      cfg.variant === "compact" ? "rw--compact" :
      cfg.variant === "ultra"   ? "rw--ultra"   : "";
    const themeClass = cfg.theme === "dark" ? "rw--dark" : "";

    const wrap = document.createElement("div");
    wrap.className = `rw ${themeClass} ${sizeClass}`;
    wrap.style.setProperty("--rw-primary", PRIMARY);

    const h2 = document.createElement("h2");
    h2.textContent = "Get Your Instant Roofing Estimate";
    wrap.appendChild(h2);

    const form = document.createElement("form");
    form.innerHTML = `
      <div class="grid">
        <div class="row">
          <label for="rw-zip">ZIP code</label>
          <input id="rw-zip" placeholder="e.g., 37203" inputmode="numeric" />
        </div>
        <div class="row">
          <label for="rw-city">City</label>
          <input id="rw-city" placeholder="e.g., Chattanooga" />
        </div>
        <div class="row">
          <label for="rw-state">State</label>
          <input id="rw-state" placeholder="e.g., TN" />
        </div>
        <div class="row">
          <label for="rw-county">County</label>
          <input id="rw-county" placeholder="e.g., Hamilton" />
        </div>
        <div class="row">
          <label for="rw-material">Material</label>
          <select id="rw-material">
            <option value="shingle">Shingle</option>
            <option value="metal">Metal</option>
            <option value="tile">Tile</option>
          </select>
        </div>
        <div class="row">
          <label for="rw-size">Home size</label>
          <select id="rw-size">
            <option value="under1500">Under 1,500 sq ft</option>
            <option value="1500to3000">1,500–3,000 sq ft</option>
            <option value="over3000">Over 3,000 sq ft</option>
          </select>
        </div>
        <div class="row">
          <label for="rw-stories">Stories</label>
          <select id="rw-stories">
            <option>1</option>
            <option selected>2</option>
            <option>3</option>
          </select>
        </div>
        <div class="row">
          <label for="rw-urgency">Urgency</label>
          <select id="rw-urgency">
            <option value="soon">Next 1–3 months</option>
            <option value="urgent">ASAP (storm damage/leak)</option>
            <option value="planning">Just planning</option>
          </select>
        </div>
      </div>
      <p class="hint">Tip: You can fill ZIP, or City+State, or County+State. We’ll use the best match.</p>
      <div class="grid">
        <div class="row">
          <label for="rw-name">Name</label>
          <input id="rw-name" placeholder="Jane Doe" required />
        </div>
        <div class="row">
          <label for="rw-email">Email</label>
          <input id="rw-email" type="email" placeholder="jane@email.com" required />
        </div>
        <div class="row">
          <label for="rw-phone">Phone</label>
          <input id="rw-phone" placeholder="(555) 555-5555" required />
        </div>
        <div class="row" style="display:flex;align-items:center;gap:8px">
          <input id="rw-consent" type="checkbox" />
          <label for="rw-consent" style="margin:0">I agree to be contacted</label>
        </div>
      </div>
      <div class="error" id="rw-err"></div>
      <div class="actions">
        <button type="submit" id="rw-submit">Get Estimate</button>
      </div>
    `;
    wrap.appendChild(form);
    return { wrap, form };
  }

  // ============== Submit handler ==============
  async function onSubmit(e, root) {
    e.preventDefault();
    const err = document.querySelector("#rw-err");
    const submitBtn = document.querySelector("#rw-submit");

    function showError(msg) { if (err) { err.textContent = msg; err.style.display = ""; } }
    function clearError(){ if (err) { err.textContent = ""; err.style.display = "none"; } }

    clearError();

    const payload = {
      client: cfg.client,
      zip: val("#rw-zip", root),
      city: val("#rw-city", root),
      state: val("#rw-state", root),
      county: val("#rw-county", root),
      material: val("#rw-material", root) || "shingle",
      size: val("#rw-size", root) || "under1500",
      stories: val("#rw-stories", root) || "2",
      urgency: val("#rw-urgency", root) || "soon",
      name: val("#rw-name", root),
      email: val("#rw-email", root),
      phone: val("#rw-phone", root),
      consent: $("#rw-consent", root)?.checked || false
    };

    if (!payload.name || !payload.email || !payload.phone) {
      return showError("Name, Email, and Phone are required.");
    }
    if (!payload.consent) {
      return showError("Please check the consent box to proceed.");
    }
    const phoneE164 = toE164US(payload.phone);
    if (!phoneE164) return showError("Please enter a valid 10-digit US phone number.");

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Calculating…"; }

    try {
      // 1) Estimate
      const q = new URLSearchParams({
        client: payload.client,
        material: payload.material,
        size: payload.size,
        stories: payload.stories,
        zip: payload.zip,
        city: payload.city,
        state: payload.state,
        county: payload.county
      });
      const estRes = await fetch(`/api/estimate?${q.toString()}`, { method: "GET" });
      if (!estRes.ok) throw new Error("Estimate failed");
      const est = await estRes.json();

      // 2) Lead submit
      const leadRes = await fetch(`/api/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: payload.client,
          name: payload.name,
          email: payload.email,
          phone: phoneE164,
          zip: payload.zip,
          city: payload.city,
          county: payload.county,
          state: payload.state,
          material: payload.material,
          size: payload.size,
          stories: payload.stories,
          urgency: payload.urgency,
          estimate: est?.estimate || null,
          consent: payload.consent
        })
      });
      if (!leadRes.ok) {
        const t = await leadRes.text();
        throw new Error(t || "Lead send failed");
      }

      // 3) Feedback
      if (submitBtn) submitBtn.textContent = "Estimate Ready ✓";
      const range = est?.estimate
        ? `$${Number(est.estimate.low).toLocaleString()} – $${Number(est.estimate.high).toLocaleString()}`
        : "N/A";
      alert(`Thanks ${payload.name}! Estimated range: ${range}\nWe’ll be in touch shortly.`);

      if (cfg.variant === "modal" && window.RoofWidget?.close) window.RoofWidget.close();
    } catch (er) {
      console.error(er);
      showError("Sorry, we couldn't calculate your estimate. Please try again.");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Get Estimate"; }
    }
  }

  // ============== Modal infra ==============
  function buildModalAndMount(formWrap) {
    const bd = document.createElement("div"); bd.className = "rw-backdrop";
    const modal = document.createElement("div"); modal.className = `rw-modal ${cfg.theme === "dark" ? "rw-dark" : ""}`;
    const card = document.createElement("div"); card.className = "rw-card"; card.setAttribute("role","dialog"); card.setAttribute("aria-modal","true");
    const closeBtn = document.createElement("button"); closeBtn.className = "rw-close"; closeBtn.setAttribute("aria-label","Close"); closeBtn.innerHTML = "×";

    card.appendChild(closeBtn);
    card.appendChild(formWrap);
    modal.appendChild(card);
    document.body.appendChild(bd);
    document.body.appendChild(modal);

    function open() {
      document.documentElement.style.overflow = "hidden";
      bd.classList.add("open"); modal.classList.add("open");
      setTimeout(()=> closeBtn.focus(), 50);
    }
    function close() {
      modal.classList.remove("open"); bd.classList.remove("open");
      document.documentElement.style.overflow = "";
    }

    // Close interactions
    closeBtn.addEventListener("click", close);
    bd.addEventListener("click", close);
    modal.addEventListener("click", (e)=>{ if (e.target === modal) close(); });
    document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") close(); });

    // External button or auto FAB
    const externalBtn = document.getElementById("rw-open");
    if (externalBtn) externalBtn.addEventListener("click", open);
    else if (cfg.modalButton === "auto") {
      const fab = document.createElement("button");
      fab.className = "rw-fab";
      fab.textContent = "Get Instant Estimate";
      fab.addEventListener("click", open);
      document.body.appendChild(fab);
    }

    // expose
    window.RoofWidget = window.RoofWidget || {};
    window.RoofWidget.open = open;
    window.RoofWidget.close = close;
  }

  // ============== Mounting ==============
  const { wrap, form } = buildForm();
  form.addEventListener("submit", (e) => onSubmit(e, wrap));

  if (cfg.variant === "modal") {
    buildModalAndMount(wrap);
  } else {
    const container = me.parentElement || document.body;
    container.insertBefore(wrap, me);
  }
})();
