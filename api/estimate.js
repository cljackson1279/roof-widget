// /api/estimate.js  (CommonJS for Vercel functions)
// Tries to load Supabase; if not installed or no env vars, it gracefully falls back.

let createClient = null;
try {
  ({ createClient } = require("@supabase/supabase-js"));
} catch (_) {
  // supabase-js not installed — we'll skip DB lookups
}

/**
 * Find the best geography factor in this priority:
 * ZIP → City+State → County+State → State
 * For each, prefer client-scoped row (client_id = <client>), else fall back to global (client_id = null).
 */
async function bestGeoMatch(sb, client, { zip, city, county, state }) {
  const tryScopes = async (query) => {
    // client-specific row
    let q = query.eq("client_id", client);
    let { data } = await q.maybeSingle();
    if (data) return { data, scope: "client" };
    // global row
    q = query.eq("client_id", null);
    ({ data } = await q.maybeSingle());
    if (data) return { data, scope: "global" };
    return null;
  };

  // ZIP
  if (zip) {
    const got = await tryScopes(
      sb.from("geo_factors")
        .select("base_mult, material_mult")
        .eq("level", "zip")
        .eq("zip", zip)
    );
    if (got) return { ...got.data, _match: "zip", _scope: got.scope };
  }

  // City+State
  if (city && state) {
    const got = await tryScopes(
      sb.from("geo_factors")
        .select("base_mult, material_mult")
        .eq("level", "city_state")
        .eq("city", city)
        .eq("state", state)
    );
    if (got) return { ...got.data, _match: "city_state", _scope: got.scope };
  }

  // County+State
  if (county && state) {
    const got = await tryScopes(
      sb.from("geo_factors")
        .select("base_mult, material_mult")
        .eq("level", "county_state")
        .eq("county", county)
        .eq("state", state)
    );
    if (got) return { ...got.data, _match: "county_state", _scope: got.scope };
  }

  // State
  if (state) {
    const got = await tryScopes(
      sb.from("geo_factors")
        .select("base_mult, material_mult")
        .eq("level", "state")
        .eq("state", state)
    );
    if (got) return { ...got.data, _match: "state", _scope: got.scope };
  }

  return null;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    // ---- Parse inputs
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

    // ---- Base ranges by size (adjust to your baseline reality)
    const bands = {
      lt1500: [8000, 12000],
      "1500to3000": [12000, 18000],
      gt3000: [18000, 26000]
    };
    let [low, high] = bands[size] || bands["1500to3000"];

    // ---- Default multipliers
    let matMult = { shingle: 1.0, tile: 1.4, metal: 1.6 }[material] || 1.0;
    let stoMult = { "1": 1.0, "2": 1.1, "3": 1.2 }[stories] || 1.0;
    let urgMult = { later: 1.0, soon: 1.05, emergency: 1.1 }[urgency] || 1.0;
    let locBaseMult = 1.0;
    let clientMargin = 0.0;

    // ---- Supabase lookups (only if env + library available)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;

    if (url && key && createClient) {
      const sb = createClient(url, key);

      // 1) Client overrides (optional)
      const { data: c } = await sb
        .from("clients")
        .select("default_margin, material_mult, stories_mult, urgency_mult")
        .eq("client_id", client)
        .maybeSingle();

      if (c) {
        clientMargin = Number(c.default_margin || 0) || 0;
        if (c.material_mult?.[material] != null)
          matMult = Number(c.material_mult[material]) || matMult;
        if (c.stories_mult?.[stories] != null)
          stoMult = Number(c.stories_mult[stories]) || stoMult;
        if (c.urgency_mult?.[urgency] != null)
          urgMult = Number(c.urgency_mult[urgency]) || urgMult;
      }

      // 2) Geography factors with fallback & scope (client → global)
      const geo = await bestGeoMatch(sb, client, { zip, city, county, state });
      if (geo) {
        locBaseMult = Number(geo.base_mult || 1.0) || 1.0;
        if (geo.material_mult?.[material] != null) {
          matMult *= Number(geo.material_mult[material] || 1.0);
        }
      }
    }

    // ---- Final math
    const mult = matMult * stoMult * urgMult * locBaseMult;
    let outLow = Math.round((low * mult) / 100) * 100;
    let outHigh = Math.round((high * mult) / 100) * 100;

    // Optional client margin applied at the end
    if (clientMargin) {
      outLow = Math.round(outLow * (1 + clientMargin));
      outHigh = Math.round(outHigh * (1 + clientMargin));
    }

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
      // Uncomment for debugging fallback behavior during testing:
      // , debug: { locBaseMult, matMult, stoMult, urgMult }
    });
  } catch (e) {
    console.error("estimate error:", e);
    return res.status(500).json({ error: "Failed to compute estimate." });
  }
};

