<script>
(function () {
  const scriptEl = document.currentScript;
  const client = scriptEl?.dataset.client || "demo";
  const calendly = scriptEl?.dataset.calendly || "";
  const theme = (scriptEl?.dataset.theme || "light").toLowerCase();

  function mount(container) {
    const root = container.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .card { font-family: system-ui,-apple-system,Segoe UI,Roboto,Inter,sans-serif; 
              max-width: 520px; margin: 12px auto; border: 1px solid #e5e7eb; 
              border-radius: 16px; padding: 16px; box-shadow: 0 4px 16px rgba(0,0,0,.06);
              background:${theme === "dark" ? "#111827" : "#fff"}; 
              color:${theme === "dark" ? "#e5e7eb" : "#111827"}; }
      h2 { font-size: 18px; margin: 0 0 8px; }
      .row { display: grid; gap: 10px; margin: 10px 0; }
      select, input { padding: 10px; border-radius: 10px; border: 1px solid #d1d5db; background:${theme==="dark"?"#111827":"#fff"}; color:inherit; }
      button { padding: 10px 14px; border-radius: 12px; border: 0; cursor: pointer; background:#111827; color:#fff; }
      button.secondary { background:#e5e7eb; color:#111827; }
      .actions { display:flex; gap:10px; justify-content:flex-end; margin-top:8px;}
      .fine { font-size:12px; opacity:.8; margin-top:8px; }
      .estimate { font-size:20px; font-weight:700; margin:8px 0; }
      a.cta { display:inline-block; padding:10px 14px; border-radius:12px; background:#2563eb; color:#fff; text-decoration:none; }
    `;
    root.appendChild(style);

    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <h2>Get Your Instant Roofing Estimate</h2>
      <div class="step step-1">
        <div class="row">
          <label>Roof material
            <select id="material">
              <option value="shingle">Asphalt Shingle</option>
              <option value="tile">Tile</option>
              <option value="metal">Metal</option>
            </select>
          </label>
          <label>Home size
            <select id="size">
              <option value="lt1500">Under 1,500 sq ft</option>
              <option value="1500to3000">1,500–3,000 sq ft</option>
              <option value="gt3000">Over 3,000 sq ft</option>
            </select>
          </label>
          <label>Stories
            <select id="stories">
              <option value="1">1</option>
              <option value="2" selected>2</option>
              <option value="3">3</option>
            </select>
          </label>
          <label>Urgency
            <select id="urgency">
              <option value="later">Next 1–3 months</option>
              <option value="soon">This month</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>
          <label>ZIP code (optional)
            <input id="zip" placeholder="e.g., 30301" />
          </label>
        </div>
        <div class="actions">
          <button id="next">Next</button>
        </div>
        <div class="fine">60 seconds. Ballpark only. Exact quote after onsite visit.</div>
      </div>

      <div class="step step-2" style="display:none;">
        <div class="row">
          <label>Your name <input id="name" placeholder="Jane Doe" /></label>
          <label>Email <input id="email" placeholder="jane@email.com" /></label>
          <label>Phone <input id="phone" placeholder="(555) 555-5555" /></label>
        </div>
        <div class="actions">
          <button class="secondary" id="back">Back</button>
          <button id="getEstimate">Get Estimate</button>
        </div>
        <div class="fine"><input type="checkbox" id="consent" /> I agree to be contacted about my estimate.</div>
      </div>

      <div class="step step-3" style="display:none;">
        <div class="estimate" id="range"></div>
        <div class="row">
          ${calendly ? `<a class="cta" id="book" target="_blank" rel="noopener">Book a 15-min consult</a>` : ""}
        </div>
        <div class="fine">We’ll confirm details and final pricing after a quick walkthrough.</div>
      </div>
    `;
    root.appendChild(el);

    const $ = (sel) => root.querySelector(sel);
    const step1 = $(".step-1"), step2 = $(".step-2"), step3 = $(".step-3");
    $("#next").addEventListener("click", () => { step1.style.display="none"; step2.style.display=""; });
    $("#back").addEventListener("click", () => { step2.style.display="none"; step1.style.display=""; });

    $("#getEstimate").addEventListener("click", async () => {
      if (!$("#consent").checked) { alert("Please check the consent box."); return; }

      const payload = {
        client,
        material: $("#material").value,
        size: $("#size").value,
        stories: $("#stories").value,
        urgency: $("#urgency").value,
        zip: $("#zip").value.trim(),
        name: $("#name").value.trim(),
        email: $("#email").value.trim(),
        phone: $("#phone").value.trim()
      };

      const qs = new URLSearchParams(payload).toString();
      const estRes = await fetch("/api/estimate?" + qs, { method: "GET" });
      const est = await estRes.json().catch(()=>null);

      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, estimate: est })
      });

      $("#range").textContent = est && est.low ? `Estimated range: $${est.low.toLocaleString()} – $${est.high.toLocaleString()}` : "Thanks! We’ll follow up with your estimate.";
      const a = root.querySelector("#book");
      if (a) a.href = calendly || "#";
      step2.style.display = "none";
      step3.style.display = "";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const slots = document.querySelectorAll('[data-roof-widget]');
    if (slots.length === 0) { const div=document.createElement("div"); div.setAttribute("data-roof-widget",""); document.body.appendChild(div); mount(div); }
    else { slots.forEach(mount); }
  });
})();
</script>
