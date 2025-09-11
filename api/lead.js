module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // For now we just acknowledge; you can wire Supabase/Resend after APIs work
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("lead error:", e);
    return res.status(500).json({ error: "Failed to handle lead" });
  }
};

