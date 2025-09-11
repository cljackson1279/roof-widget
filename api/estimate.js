// /api/estimate.js  (CommonJS for Vercel Node functions)
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const {
      client = "demo",
      material = "shingle",
      size = "1500to3000",
      stories = "2",
      urgency = "soon",
      zip = "",
      city = "",
      state = ""
    } = req.query;

    // 1) Base ranges by size
    const bands = {
      lt1500: [8000, 12000],
      "1500to3000": [12000, 18000],
      gt3000: [18000, 26000]
    };
    let [low, high] = bands[size] || bands["1500to3000"];

    // 2) Default multipliers
    let matMult = { shingle:1.0, tile:1.4, metal:1.6 }[material] || 1.0;
    let stoMult = { "1":1.0, "2":1.1, "3":1.2 }[stories] || 1.0;
    let urgMult = { later:1.0, soon:1.05, emergency:1.1 }[urgency] || 1.0;
    let locBaseMult = 1.0;

    // 3) Pull client + location factors from Supabase if available
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (url && key) {
      const sb = createClient(url, key);

      // client-level multipliers
      const { data: c } = await sb
        .from("clients")
        .select("material_mult, stories_mult, urgency_mult")
        .eq("client_id", client)
        .single();

      if (c?.material_mult && c.material_mult[material] != null)
        matMult = Number(c.material_mult[material]) || matMult;
      if (c?.stories_mult && c.stories_mult[stories] != null)
        stoMult = Number(c.stories_mult[stories]) || stoMult;
      if (c?.urgency_mult && c.urgency_mult[urgency] != null)
        urgMult = Number(c.urgency_mult[urgency]) || urgMult;

      // location resolution: ZIP → City+State → State
      let lf = null;
      if (zip) {
        const { data } = await sb
          .from("location_factors")
          .select("base_mult, material_mult")
          .eq("client_id", client)
          .eq("zip", zip)
          .maybeSingle();
        lf = data || lf;
      }
      if (!lf && city && state) {
        const { data } = await sb
          .from("location_factors")
          .select("base_mult, material_mult")
          .eq("client_id", client)
          .eq("city", city)
          .eq("state", state)
          .maybeSingle();
        lf = data || lf;
      }
      if (!lf && state) {
        const { data } = await sb
          .from("location_factors")
          .select("base_mult, material_mult")
          .eq("client_id", client)
          .eq("state", state)
          .maybeSingle();
        lf = data || lf;
      }

      if (lf) {
        locBaseMult = Number(lf.base_mult || 1.0) || 1.0;
        if (lf.material_mult && lf.material_mult[material] != null) {
          matMult = matMult * Number(lf.material_mult[material] || 1.0);
        }
      }
    }

    const mult = matMult * stoMult * urgMult * locBaseMult;
    const outLow  = Math.round((low  * mult) / 100) * 100;
    const outHigh = Math.round((high * mult) / 100) * 100;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      low: outLow,
      high: outHigh,
      currency: "USD",
      client, material, size, stories, urgency, zip, city, state
    });
  } catch (e) {
    console.error("estimate error:", e);
    return res.status(500).json({ error: "Failed to compute estimate." });
  }
};

