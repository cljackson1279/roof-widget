// /api/estimate.js
let createClient = null;
try {
  ({ createClient } = require("@supabase/supabase-js"));
} catch (_) {}

async function bestGeoMatch(sb, { zip, city, county, state }) {
  // ZIP
  if (zip) {
    const { data } = await sb
      .from("geo_factors")
      .select("base_mult, material_mult")
      .eq("level", "zip")
      .eq("zip", zip)
      .maybeSingle();
    if (data) return data;
  }

  // City+State
  if (city && state) {
    const { data } = await sb
      .from("geo_factors")
      .select("base_mult, material_mult")
      .eq("level", "city_state")
      .eq("city", city)
      .eq("state", state)
      .maybeSingle();
    if (data) return data;
  }

  // County+State
  if (county && state) {
    const { data } = await sb
      .from("geo_factors")
      .select("base_mult, material_mult")
      .eq("level", "county_state")
      .eq("county", county)
      .eq("state", state)
      .maybeSingle();
    if (data) return data;
  }

  // State
  if (state) {
    const { data } = await sb
      .from("geo_factors")
      .select("base_mult, material_mult")
      .eq("level", "state")
      .eq("state", state)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

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
      county = "",
      state = ""
    } = req.query;

    // Base ranges
    const bands = {
      lt1500: [8000, 12000],
      "1500to3000": [12000, 18000],
      gt3000: [18000, 26000]
    };
    let [low, high] = bands[size] || bands["1500to3000"];

    // Defaults
    let matMult = { shingle: 1.0, tile: 1.4, metal: 1.6 }[material] || 1.0;
    let stoMult = { "1": 1.0, "2": 1.1, "3": 1.2 }[stories] || 1.0;
    let urgMult = { later: 1.0, soon: 1.05, emergency: 1.1 }[urgency] || 1.0;
    let locBaseMult = 1.0;

    // Supabase integration (if env + library exist)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (url && key && createClient) {
      const sb = createClient(url, key);

      // Get client overrides
      const { data: c } = await sb
        .from("clients")
        .select("material_mult, stories_mult, urgency_mult")
        .eq("client_id", client)
        .single();

      if (c?.material_mult?.[material] != null)
        matMult = Number(c.material_mult[material]) || matMult;
      if (c?.stories_mult?.[stories] != null)
        stoMult = Number(c.stories_mult[stories]) || stoMult;
      if (c?.urgency_mult?.[urgency] != null)
        urgMult = Number(c.urgency_mult[urgency]) || urgMult;

      // Geo factors (fallback order)
      const geo = await bestGeoMatch(sb, { zip, city, county, state });
      if (geo) {
        locBaseMult = Number(geo.base_mult || 1.0) || 1.0;
        if (geo.material_mult?.[material] != null) {
          matMult *= Number(geo.material_mult[material] || 1.0);
        }
      }
    }

    // Final calc
    const mult = matMult * stoMult * urgMult * locBaseMult;
    const outLow = Math.round((low * mult) / 100) * 100;
    const outHigh = Math.round((high * mult) / 100) * 100;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      low: outLow,
      high: outHigh,
      currency: "USD",
      client,
      material,
      size,
      stories,
      urgency,
      zip,
      city,
      county,
      state
    });
  } catch (e) {
    console.error("estimate error:", e);
    return res.status(500).json({ error: "Failed to compute estimate." });
  }
};

