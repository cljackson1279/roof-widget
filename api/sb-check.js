// /api/sb-check.js
let createClient = null;
try { ({ createClient } = require("@supabase/supabase-js")); } catch (_) {}

module.exports = async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!url || !key) return res.status(200).json({ ok: false, reason: "missing_env" });
    if (!createClient)   return res.status(200).json({ ok: false, reason: "supabase_js_missing" });

    const sb = createClient(url, key);

    // 1) Read demo client (for owner email/phone)
    const { data: clientRow, error: clientErr } = await sb
      .from("clients").select("client_id, owner_email, owner_phone").eq("client_id","demo").maybeSingle();

    // 2) Minimal insert test (safe columns only), then delete it
    const { data: ins, error: insErr } = await sb
      .from("leads").insert([{ client_id:"demo", name:"SB Check", email:"sbcheck@example.com", phone:"+15555550123" }])
      .select("id").single();

    if (ins?.id) { await sb.from("leads").delete().eq("id", ins.id); }

    return res.status(200).json({
      ok: true,
      env_ok: true,
      clientRow,
      clientErr,
      insert_ok: !!ins?.id,
      insertErr: insErr || null
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
};

