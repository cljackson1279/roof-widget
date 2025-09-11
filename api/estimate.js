import { createClient } from "@supabase/supabase-js";

// GET /api/estimate?client=...&material=...&size=...&stories=...&urgency=...&zip=...
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const {
      client = "demo", material = "shingle", size = "1500to3000",
      stories = "2", urgency = "soon", zip
    } = req.query;

    // default base bands
    const baseBands = {
      lt1500: [8000, 12000],
      "1500to3000": [12000, 18000],
      gt3000: [18000, 26000]
    };
    let [low, high] = baseBands[size] || baseBands["1500to3000"];

    // per-client multipliers from Supabase (optional)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE; // server-only
    if (supabaseUrl && supabaseKey) {
      const sb = createClient(supabaseUrl, supabaseKey);
      const { data: cfg } = await sb
        .from("clients")
        .select("material_mult, stories_mult, urgency_mult, zip_mult")
        .eq("client_id", client)
        .single();

      const materialMult = cfg?.material_mult?.[material] ?? { shingle:1.0, tile:1.4, metal:1.6 }[material] ?? 1.0;
      const storiesMult  = cfg?.stories_mult?.[stories] ?? { "1":1.0, "2":1.1, "3":1.2 }[stories] ?? 1.0;
      const urgencyMult  = cfg?.urgency_mult?.[urgency] ?? { later:1.0, soon:1.05, emergency:1.1 }[urgency] ?? 1.0;

      let zipMult = 1.0;
      if (zip && cfg?.zip_mult && cfg.zip_mult[zip]) zipMult = cfg.zip_mult[zip];

      const mult = materialMult * storiesMult * urgencyMult * zipMult;
      low = Math.round((low * mult) / 100) * 100;
      high = Math.round((high * mult) / 100) * 100;
    } else {
      const materialMult = { shingle:1.0, tile:1.4, metal:1.6 }[material] ?? 1.0;
      const storiesMult  = { "1":1.0, "2":1.1, "3":1.2 }[stories] ?? 1.0;
      const urgencyMult  = { later:1.0, soon:1.05, emergency:1.1 }[urgency] ?? 1.0;
      const mult = materialMult * storiesMult * urgencyMult;
      low = Math.round((low * mult) / 100) * 100;
      high = Math.round((high * mult) / 100) * 100;
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ low, high, currency: "USD", material, size, stories, urgency, client });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ low: 12000, high: 18000, currency: "USD", fallback: true });
  }
}
