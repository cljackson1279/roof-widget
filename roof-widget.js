/* roof-widget/roof-widget.js */
/* Instant Roofing Estimate — inline result panel, client-side fallback if API fails, aligned form, size presets, modal, brand color detection */

(function () {
  const me = document.currentScript;
  const cfg = {
    client: (me?.dataset?.client || "demo").trim(),
    variant: (me?.dataset?.variant || "full").toLowerCase(),
    theme: (me?.dataset?.theme || "light").toLowerCase(),
    width: me?.dataset?.width || "560px",
    primaryOverride: me?.dataset?.primary || "",
    modalButton: (me?.dataset?.modalButton || "").toLowerCase()
  };

  // -------- Brand color detection --------
  function toHex(n){return Number(n).toString(16).padStart(2,"0")}
  function rgbToHex(rgb){const m=rgb.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i);return m?`#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`:null}
  function pickColor(list){for(const c of list||[]){if(!c)continue;if(/^#([0-9a-f]{3,8})$/i.test(c))return c;if(c.startsWith("rgb")){const h=rgbToHex(c);if(h)return h}}return null}
  function detectBrand(){
    const meta=document.querySelector('meta[name="theme-color"]')?.content?.trim();
    const root=getComputedStyle(document.documentElement);
    const vars=[root.getPropertyValue("--color-primary"),root.getPropertyValue("--primary"),root.getPropertyValue("--brand"),root.getPropertyValue("--accent")].map(v=>v&&v.trim()).filter(Boolean);
    const els=[...document.querySelectorAll("button,.button,.btn,[class*=primary]")].slice(0,20);
    const bgs=els.map(e=>getComputedStyle(e).backgroundColor).filter(c=>c&&c!=="transparent"&&c!=="rgba(0, 0, 0, 0)");
    const fg=els.map(e=>getComputedStyle(e).color);
    const header=document.querySelector("header,.site-header,.navbar"); const headerBg=header?getComputedStyle(header).backgroundColor:"";
    return pickColor([cfg.primaryOverride,meta,...vars,...bgs,headerBg,...fg])||"#0f172a";
  }
  const PRIMARY = detectBrand();

  // -------- Styles --------
  const css = `
  .rw{--rw-gap:12px;--rw-pad:14px;--rw-border:#e5e7eb;--rw-bg:#fff;--rw-text:#111827;--rw-muted:#6b7280;--rw-primary:${PRIMARY};
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:var(--rw-text);background:var(--rw-bg);
      border:1px solid var(--rw-border);border-radius:12px;padding:var(--rw-pad);box-shadow:0 2px 12px rgba(0,0,0,.06);
      width:100%;max-width:${cfg.width};box-sizing:border-box}
  .rw--dark{--rw-border:#374151;--rw-bg:#0f172a;--rw-text:#f3f4f6;--rw-muted:#9ca3af}
  .rw h2{margin:0 0 8px;font-size:18px;line-height:1.25}
  .rw .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media (max-width:640px){.rw .grid{grid-template-columns:1fr}}
  .rw .field{display:flex;flex-direction:column;gap:6px}
  .rw label{font-size:12px;color:var(--rw-muted)}
  .rw input,.rw select{width:100%;box-sizing:border-box;border:1px solid var(--rw-border);border-radius:10px;
      padding:8px 10px;line-height:1.2;background:transparent;color:inherit;min-height:36px}
  .rw input[type=checkbox]{width:14px;height:14px;flex-shrink:0;margin:0}
  .rw .consent{flex-direction:row;align-items:center;gap:6px}
  .rw .consent label{font-size:12px;color:var(--rw-muted);margin:0;line-height:1.2}
  .rw .hint{font-size:12px;color:var(--rw-muted);margin:6px 0 8px}
  .rw .actions{display:flex;justify-content:flex-end;margin-top:8px}
  .rw button{border:1px solid var(--rw-primary);background:var(--rw-primary);color:#fff;border-radius:10px;padding:9px 14px;
      cursor:pointer;font-weight:600;min-height:36px}
  .rw .result{margin-top:10px;border:1px dashed var(--rw-border);border-radius:10px;padding:12px;display:none}
  .rw .result.show{display:block}
  .rw .result h3{margin:0 0 6px;font-size:16px}
  .rw .result .range{font-size:18px;font-weight:800}
  .rw .result .meta{font-size:12px;color:var(--rw-muted);margin-top:4px}
  .rw .error{display:none;margin:6px 0 0;color:#dc2626;font-size:13px}
  .rw .error.show{display:block}
  .rw-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:.15s;z-index:99998}
  .rw-modal{position:fixed;inset:0;display:grid;place-items:center;opacity:0;pointer-events:none;transition:.15s;z-index:99999}
  .rw-modal.open,.rw-backdrop.open{opacity:1;pointer-events:auto}
  .rw-card{width:min(96vw,560px);max-height:90vh;overflow:auto;border-radius:12px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 10px 30px rgba(0,0,0,.18)}
  .rw-dark .rw-card{background:#0f172a;border-color:#374151}
  .rw-close{position:absolute;top:10px;right:10px;border:none;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#6b7280}
  .rw-fab{position:fixed;right:18px;bottom:18px;border:0;border-radius:999px;padding:12px 16px;background:var(--rw-primary);color:#fff;font-weight:700;
      box-shadow:0 6px 18px rgba(0,0,0,.2);cursor:pointer;z-index:99997}
  @media (max-width:420px){.rw-fab{left:18px;right:18px;width:auto}}
  `;
  const style=document.createElement("style"); style.textContent=css; document.head.appendChild(style);

  // -------- Helpers --------
  const $ = (sel, el)=> (el||document).querySelector(sel);
  const val = (sel, el)=> ($(sel, el)?.value || "").trim();
  function toE164US(p){if(!p)return null;const d=String(p).replace(/\D/g,"");if(d.length===11&&d.startsWith("1"))return "+"+d; if(d.length===10)return "+1"+d; return null;}

  // -------- Fallback estimator (client-side) --------
  function fallbackEstimate({material,size,stories,urgency}) {
    // Base ranges by size (shingle baseline)
    const base = {
      under1500: [8000, 12000],
      "1500to3000": [12000, 18000],
      over3000: [18000, 28000]
    }[size || "under1500"] || [10000, 15000];

    // Material multipliers vs shingle
    const matMul = { shingle: 1.0, metal: 1.6, tile: 1.9 }[material || "shingle"] || 1.0;

    // Stories multiplier
    const s = Number(stories || 1);
    const storyMul = s >= 3 ? 1.20 : s >= 2 ? 1.10 : 1.00;

    // Urgency (optional small uplift)
    const urgMul = urgency === "urgent" ? 1.05 : 1.00;

    const low = Math.round(base[0] * matMul * storyMul * urgMul);
    const high = Math.round(base[1] * matMul * storyMul * urgMul);
    return { low, high };
  }

  // -------- Build form + result --------
  function buildForm(){
    const sizeClass = cfg.variant==="compact"?"rw--compact":(cfg.variant==="ultra"?"rw--ultra":"");
    const themeClass = cfg.theme==="dark"?"rw--dark":"";
    const wrap=document.createElement("div");
    wrap.className=`rw ${themeClass} ${sizeClass}`;
    wrap.style.setProperty("--rw-primary", PRIMARY);

    const h2=document.createElement("h2"); h2.textContent="Get Your Instant Roofing Estimate"; wrap.appendChild(h2);

    const form=document.createElement("form");
    form.noValidate = true;
    form.innerHTML=`
      <div class="grid">
        <div class="field"><label for="rw-zip">ZIP code</label><input id="rw-zip" placeholder="e.g., 37203" inputmode="numeric" /></div>
        <div class="field"><label for="rw-city">City</label><input id="rw-city" placeholder="e.g., Chattanooga" /></div>
        <div class="field"><label for="rw-state">State</label><input id="rw-state" placeholder="e.g., TN" /></div>
        <div class="field"><label for="rw-county">County</label><input id="rw-county" placeholder="e.g., Hamilton" /></div>
        <div class="field"><label for="rw-material">Material</label>
          <select id="rw-material"><option value="shingle">Shingle</option><option value="metal">Metal</option><option value="tile">Tile</option></select></div>
        <div class="field"><label for="rw-size">Home size</label>
          <select id="rw-size"><option value="under1500">Under 1,500 sq ft</option><option value="1500to3000">1,500–3,000 sq ft</option><option value="over3000">Over 3,000 sq ft</option></select></div>
        <div class="field"><label for="rw-stories">Stories</label>
          <select id="rw-stories"><option>1</option><option selected>2</option><option>3</option></select></div>
        <div class="field"><label for="rw-urgency">Urgency</label>
          <select id="rw-urgency"><option value="soon">Next 1–3 months</option><option value="urgent">ASAP (storm damage/leak)</option><option value="planning">Just planning</option></select></div>
      </div>
      <p class="hint">Tip: Fill ZIP, or City+State, or County+State. We’ll use the best match.</p>
      <div class="grid">
        <div class="field"><label for="rw-name">Name</label><input id="rw-name" placeholder="Jane Doe" required /></div>
        <div class="field"><label for="rw-email">Email</label><input id="rw-email" type="email" placeholder="jane@email.com" required /></div>
        <div class="field"><label for="rw-phone">Phone</label><input id="rw-phone" placeholder="(555) 555-5555" required /></div>
        <div class="field consent"><input id="rw-consent" type="checkbox" required /><label for="rw-consent">I agree to be contacted</label></div>
      </div>
      <div class="error" id="rw-err" aria-live="polite"></div>
      <div class="actions"><button type="submit" id="rw-submit">Get Estimate</button></div>
      <div class="result" id="rw-result" aria-live="polite"></div>
    `;
    wrap.appendChild(form);
    return {wrap, form};
  }

  // -------- Submit handler --------
  async function onSubmit(e, root){
    e.preventDefault();
    const err=$("#rw-err",root), btn=$("#rw-submit",root), result=$("#rw-result",root);
    function showError(m){ if(err){err.textContent=m; err.classList.add("show");} if(result){result.classList.remove("show"); result.innerHTML="";} }
    function clearError(){ if(err){err.textContent=""; err.classList.remove("show");} }

    clearError();

    const consentEl = $("#rw-consent", root);
    if (!consentEl?.checked) {
      showError("Please check the consent box to proceed.");
      consentEl?.focus();
      return;
    }

    const payload={
      client: cfg.client,
      zip: val("#rw-zip",root),
      city: val("#rw-city",root),
      state: val("#rw-state",root),
      county: val("#rw-county",root),
      material: val("#rw-material",root) || "shingle",
      size: val("#rw-size",root) || "under1500",
      stories: val("#rw-stories",root) || "2",
      urgency: val("#rw-urgency",root) || "soon",
      name: val("#rw-name",root),
      email: val("#rw-email",root),
      phone: val("#rw-phone",root),
      consent: true
    };

    if(!payload.name || !payload.email || !payload.phone){
      showError("Name, Email, and Phone are required.");
      return;
    }

    const phoneE164=toE164US(payload.phone);
    if(!phoneE164){
      showError("Enter a valid 10-digit US phone number.");
      $("#rw-phone",root)?.focus();
      return;
    }

    if(btn){btn.disabled=true;btn.textContent="Calculating…";}
    if(result){result.classList.add("show"); result.innerHTML=`<h3>Calculating…</h3><div class="meta">Checking local pricing…</div>`;}

    let finalLow, finalHigh, usedFallback = false;

    try{
      // 1) Try server estimate first
      const q=new URLSearchParams({
        client: payload.client, material: payload.material, size: payload.size, stories: payload.stories,
        zip: payload.zip, city: payload.city, state: payload.state, county: payload.county
      });
      const estRes=await fetch(`/api/estimate?${q.toString()}`,{method:"GET"});
      if(estRes.ok){
        const est=await estRes.json();
        const eLow = Number(est?.estimate?.low);
        const eHigh = Number(est?.estimate?.high);
        if (isFinite(eLow) && isFinite(eHigh) && eLow > 0 && eHigh > 0) {
          finalLow = Math.round(eLow);
          finalHigh = Math.round(eHigh);
        }
      }
      // 2) Fallback if missing/invalid
      if (finalLow == null || finalHigh == null) {
        const fb = fallbackEstimate(payload);
        finalLow = fb.low; finalHigh = fb.high; usedFallback = true;
      }

      // 3) Show result immediately
      const range = `$${finalLow.toLocaleString()} – $${finalHigh.toLocaleString()}`;
      const meta = [
        payload.material ? `Material: <b>${payload.material}</b>` : null,
        payload.stories ? `Stories: <b>${payload.stories}</b>` : null,
        payload.size ? `Size: <b>${payload.size}</b>` : null,
        usedFallback ? `<span style="color:#6b7280">(quick estimate)</span>` : null
      ].filter(Boolean).join(" &nbsp;•&nbsp; ");
      if(result){
        result.classList.add("show");
        result.innerHTML = `
          <h3>Estimated Price Range</h3>
          <div class="range">${range}</div>
          <div class="meta">${meta}</div>
          <div class="meta">A local pro will confirm with a quick roof measurement.</div>
        `;
      }

      // 4) Send lead (don’t block UX; still await to catch hard errors)
      const leadRes=await fetch(`/api/lead`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({...payload, phone: phoneE164, estimate: {low: finalLow, high: finalHigh}, estimate_source: usedFallback ? "fallback" : "server"})
      });
      if(!leadRes.ok){
        // Don’t clear the visible estimate; just log
        console.error("Lead send failed:", await leadRes.text());
      }

    }catch(e){
      console.error(e);
      // Even if both paths blew up (unlikely), keep fallback visible
      if(result && (!finalLow || !finalHigh)){
        const fb = fallbackEstimate(payload);
        const range = `$${fb.low.toLocaleString()} – $${fb.high.toLocaleString()}`;
        result.classList.add("show");
        result.innerHTML = `
          <h3>Estimated Price Range</h3>
          <div class="range">${range}</div>
          <div class="meta">Material: <b>${payload.material}</b> &nbsp;•&nbsp; Stories: <b>${payload.stories}</b> &nbsp;•&nbsp; Size: <b>${payload.size}</b> &nbsp;•&nbsp; <span style="color:#6b7280">(quick estimate)</span></div>
          <div class="meta">A local pro will confirm with a quick roof measurement.</div>
        `;
      }
    } finally{
      if(btn){btn.disabled=false;btn.textContent="Get Estimate";}
    }
  }

  // -------- Modal infra --------
  function buildModalAndMount(formWrap){
    const bd=document.createElement("div");bd.className="rw-backdrop";
    const modal=document.createElement("div");modal.className=`rw-modal ${cfg.theme==="dark"?"rw-dark":""}`;
    const card=document.createElement("div");card.className="rw-card";card.setAttribute("role","dialog");card.setAttribute("aria-modal","true");
    const closeBtn=document.createElement("button");closeBtn.className="rw-close";closeBtn.setAttribute("aria-label","Close");closeBtn.innerHTML="×";
    card.appendChild(closeBtn);card.appendChild(formWrap);modal.appendChild(card);
    document.body.appendChild(bd);document.body.appendChild(modal);
    function open(){document.documentElement.style.overflow="hidden";bd.classList.add("open");modal.classList.add("open");setTimeout(()=>closeBtn.focus(),50);}
    function close(){modal.classList.remove("open");bd.classList.remove("open");document.documentElement.style.overflow="";}
    closeBtn.addEventListener("click",close);bd.addEventListener("click",close);
    modal.addEventListener("click",(e)=>{if(e.target===modal)close();});
    document.addEventListener("keydown",(e)=>{if(e.key==="Escape")close();});
    const externalBtn=document.getElementById("rw-open");
    if(externalBtn) externalBtn.addEventListener("click",open);
    else if(cfg.modalButton==="auto"){const fab=document.createElement("button");fab.className="rw-fab";fab.textContent="Get Instant Estimate";fab.addEventListener("click",open);document.body.appendChild(fab);}
    window.RoofWidget=window.RoofWidget||{};window.RoofWidget.open=open;window.RoofWidget.close=close;
  }

  // -------- Mount --------
  const {wrap, form}=buildForm();
  form.addEventListener("submit",(e)=>onSubmit(e,wrap));
  if(cfg.variant==="modal"){buildModalAndMount(wrap);}else{const container=me.parentElement||document.body;container.insertBefore(wrap,me);}
})();
