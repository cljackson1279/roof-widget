(function () {
  function mount(container) {
    const root = container.attachShadow({ mode: "open" });

    const s = document.createElement("style");
    s.textContent = `
      .card{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,sans-serif;max-width:520px;margin:12px auto;padding:16px;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.06)}
      .row{display:grid;gap:10px;margin:10px 0}
      select,input{padding:10px;border-radius:10px;border:1px solid #d1d5db}
      button{padding:10px 14px;border-radius:12px;border:0;cursor:pointer;background:#111827;color:#fff}
      .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:8px}
      .estimate{font-weight:700;font-size:20px;margin:8px 0}
      .error{color:#b91c1c;font-size:14px;margin-top:6px}
    `;
    root.appendChild(s);

    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <h2>Get Your Instant Roofing Estimate</h2>
      <div class="row">
        <label>ZIP code
          <input id="zip" maxlength="10" placeholder="e.g., 37203" />
        </label>
        <label>Material
          <select id="material">
            <option value="shingle">Shingle</option>
            <option value="tile">Tile</option>
            <option value="metal">Metal</option>
          </select>
        </label>
        <label>Home size
          <select id="size">
            <option value="lt1500">Under 1,500 sq ft</option>
            <option value="1500to3000">1,500–3,000</option>
            <option value="gt3000">Over 3,000</option>
          </select>
        </label>
        <label>Stories
          <select id="stories">
            <option>1</option>
            <option selected>2</option>
            <option>3</option>
          </select>
        </label>
        <label>Urgency
          <select id="urgency">
            <option value="later">Next 1–3 months</option>
            <option value="soon">This month</option>
            <option value="emergency">Emergency</option>
          </select>
        </label>
      </div>
      <div class="row">
        <label>Name <input id="name" placeholder="Jane Doe" /></label>
        <label>Email <input id="email" placeholder="jane@email.com" /></label>
        <label>Phone <input id="phone" placeholder="(555) 555-5555" /></label>
        <label><input type="checkbox" id="consent" /> I agree to be contacted</label>
      </div>
      <div class="actions"><button id="go">Get Estimate</button></div>
      <div class="estimate" id="out"></div>
      <div class="error" id="err" style="display:none;"></div>
    `;
    root.appendChild(el);

    const $ = (sel) => root.querySelector(sel);
    const out = $("#out");
    const err = $("#err");

    $("#go").addEventListener("click", async () => {
      err.style.display = "none";
      err.textContent = "";
      out.textContent = "";

      if (!$("#consent").checked) {
        err.textContent = "Please check the consent box.";
        err.style.display = "";
        return;
      }

      const params = new URLSearchParams({
        client: "demo",
        zip: $("#zip").value.trim(),
        material: $("#material").value,
        size: $("#size").value,
        stories: $("#stories").value,
        urgency: $("#urgency").value,
        name: $("#name").value,
        email: $("#email").value,
        phone: $("#phone").value
      });

      try {
        const r = await fetch("/api/estimate?" + params.toString());
        if (!r.ok) throw new Error("Estimate API returned " + r.status);
        const j = await r.json();
        if (!j || typeof j.low !== "number" || typeof j.high !== "number") {
          throw new Error("Estimate response malformed");
        }
        out.textContent = `Estimated range: $${j.low.toLocaleString()} – $${j.high.toLocaleString()}`;

        // fire-and-forget lead log
        fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...Object.fromEntries(params), estimate: j })
        }).catch(() => {});
      } catch (e) {
        console.error(e);
        err.textContent = "Sorry, we couldn't calculate your estimate. Please try again.";
        err.style.display = "";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const slot =
      document.querySelector("[data-roof-widget]") ||
      (() => { const d = document.createElement("div"); d.setAttribute("data-roof-widget",""); document.body.appendChild(d); return d; })();
    mount(slot);
  });
})();

