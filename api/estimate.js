module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { material = "shingle", size = "1500to3000", stories = "2", urgency = "soon" } = req.query;

    const base = {
      lt1500: [8000, 12000],
      "1500to3000": [12000, 18000],
      gt3000: [18000, 26000]
    }[size] || [12000, 18000];

    const materialMult = { shingle: 1.0, tile: 1.4, metal: 1.6 }[material] || 1.0;
    const storiesMult  = { "1": 1.0, "2": 1.1, "3": 1.2 }[stories] || 1.0;
    const urgencyMult  = { later: 1.0, soon: 1.05, emergency: 1.1 }[urgency] || 1.0;

    const mult = materialMult * storiesMult * urgencyMult;
    const low  = Math.round((base[0] * mult) / 100) * 100;
    const high = Math.round((base[1] * mult) / 100) * 100;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ low, high, currency: "USD", material, size, stories, urgency });
  } catch (e) {
    console.error("estimate error:", e);
    return res.status(500).json({ error: "Failed to compute estimate." });
  }
};

