/* roof-widget/roof-widget.js */
/* Instant Roofing Estimate — aligned form, size presets (full/compact/ultra), modal, brand color detection, proportionate checkbox */

(function () {
  // --- Config from <script> tag ---
  const me = document.currentScript;
  const cfg = {
    client: (me?.dataset?.client || "demo").trim(),
    variant: (me?.dataset?.variant || "full").toLowerCase(),
    theme: (me?.dataset?.theme || "light").toLowerCase(),
    width: me?.dataset?.width || "560px",
    primaryOverride: me?.dataset?.primary || "",
    modalButton: (me?.dataset?.modalButton || "").toLowerCase()
  };

  // --- Brand color detection ---
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

  // --- Styles ---
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
  /* proportionate checkbox */
  .rw input[type=checkbox]{width:14px;height:14px;flex-shrink:0;margin:0}
  .rw .consent{flex-direction:row;align-items:center;gap:6px}
  .rw .consent label{font-size:12px;color:var(--rw-muted);margin:0;line-height:1.2}
  .rw .hint{font-size:12px;color:var(--rw-muted);margin:6px 0 8px}
  .rw .actions{display:flex;justify-content:flex-end;margin-top:8px}
  .rw button{border:1px solid var(--rw-primary);background:var(--rw-primary);color:#fff;border-radius:10px;padding:9px 14px;
      cursor:pointer;font-weight:600;min-height:36px}
  /* compact */
  .rw--compact{--rw-gap:10px;--rw-pad:12px}
  .rw--compact h2{font-size:17px;margin-bottom:6px}
  .rw--compact .grid{gap:10px}
  .rw--compact input,.rw--compact select{padding:7px 10px;border-radius:8px}
  /* ultra */
  .rw--ultra{--rw-gap:8px;--rw-pad:10px}
  .rw--ultra h2{font-size:16px;margin-bottom:4px}
  .rw--ultra .grid{grid-template-columns:1fr;gap:8px}
  .rw--ultra .hint{display:none}
  /* errors */
  .rw .error{display:none;margin:6px 0 0;color:#dc2626;font-size:13px}
  /* modal */
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

  // --- Helpers ---
  const $ = (sel, el)=> (el||document).querySelector(sel);
  const val = (sel, el)=> ($(sel, el)?.value || "").trim();
  function toE164US(p){if(!p)return null;const d=String(p).replace(/\D/g,"");if(d.length===11&&d.startsWith("1"))return "+"+d; if(d.length===10)return "+1"+d; return null;}

  // --- Build form ---
  function buildForm(){
    const sizeClass = cfg.variant==="compact"?"rw--compact":(cfg.variant==="ultra"?"rw--ultra":"");
    const themeClass = cfg.theme==="dark"?"rw--dark":"";
    const wrap=document.createElement("div");
    wrap.className=`rw ${themeClass} ${sizeClass}`;
    wrap.style.setProperty("--rw-primary", PRIMARY);

    const h2=document.createElement("h2"); h2.textContent="Get Your Instant Roofing Estimate"; wrap.appendChild(h2);

    const form=document.createElement("form");
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
        <div class="field consent"><input id="rw-consent" type="checkbox" /><label for="rw-consent">I agree to be contacted</label></div>
      </div>
      <div class="error" id="rw-err"></div>
      <div class="actions"><button type="submit" id="rw-submit">Get Estimate</button></div>
    `;
    wrap.appendChild(form);
    return {wrap, form};
  }

  // --- Submit handler ---
  async function onSubmit(e, root){
    e.preventDefault();
    const err=$("#rw-err",root), btn=$("#rw-submit",root);
    const payload={client:cfg.client,zip:val("#rw-zip",root),city:val("#rw-city",root),state:val("#rw-state",root),county:val("#rw-county",root),
      material:val("#rw-material",root)||"shingle",size:val("#rw-size",root)||"under1500",stories:val("#rw-stories",root)||"2",
      urgency:val("#rw-urgency",root)||"soon",name:val("#rw-name",root),email:val("#rw-email",root),phone:val("#rw-phone",root),
      consent:$("#rw-consent",root)?.checked||false};
    function showError(m){if(err){err.textContent=m;err.style.display="";}} function clearError(){if(err){err.textContent="";err.style.display="none";}}
    clearError();
    if(!payload.name||!payload.email||!payload.phone) return showError("Name, Email, and Phone are required.");
    if(!payload.consent) return showError("Please check the consent box to proceed.");
    const phoneE164=toE164US(payload.phone); if(!phoneE164) return showError("Enter a valid 10-digit US phone number.");
    if(btn){btn.disabled=true;btn.textContent="Calculating…";}
    try{
      const q=new URLSearchParams({client:payload.client,material:payload.material,size:payload.size,stories:payload.stories,zip:payload.zip,city:payload.city,state:payload.state,county:payload.county});
      const estRes=await fetch(`/api/estimate?${q.toString()}`,{method:"GET"}); if(!estRes.ok) throw new Error("Estimate failed");
      const est=await estRes.json();
      const leadRes=await fetch(`/api/lead`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,phone:phoneE164,estimate:est?.estimate||null})});
      if(!leadRes.ok) throw new Error(await leadRes.text()||"Lead send failed");
      if(btn) btn.textContent="Estimate Ready ✓";
      const range=est?.estimate?`$${Number(est.estimate.low).toLocaleString()} – $${Number(est.estimate.high).toLocaleString()}`:"N/A";
      alert(`Thanks ${payload.name}! Estimated range: ${range}\\nWe’ll be in touch shortly.`);
      if(cfg.variant==="modal"&&window.RoofWidget?.close) window.RoofWidget.close();
    }catch(e){console.error(e);showError("Sorry, we couldn't calculate your estimate. Please try again.");}
    finally{if(btn){btn.disabled=false;btn.textContent="Get Estimate";}}
  }

  // --- Modal infra ---
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

  // --- Mount ---
  const {wrap, form}=buildForm();
  form.addEventListener("submit",(e)=>onSubmit(e,wrap));
  if(cfg.variant==="modal"){buildModalAndMount(wrap);}else{const container=me.parentElement||document.body;container.insertBefore(wrap,me);}
})();
