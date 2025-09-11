import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const {
      client = "demo", name = "", email = "", phone = "",
      material, size, stories, urgency, zip, estimate
    } = body;

    // Save to Supabase (server key only)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
    let ownerEmail = "";

    if (supabaseUrl && supabaseKey) {
      const sb = createClient(supabaseUrl, supabaseKey);

      // lookup owner email for this client
      const { data: c } = await sb.from("clients").select("owner_email").eq("client_id", client).single();
      ownerEmail = c?.owner_email || "";

      // insert lead
      await sb.from("leads").insert({
        client_id: client, name, email, phone, material, size, stories, urgency, zip,
        est_low: estimate?.low ?? null, est_high: estimate?.high ?? null
      });
    }

    // Email owner (Resend)
    if (process.env.RESEND_API_KEY && ownerEmail) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const html = `
        <h2>New Roofing Lead</h2>
        <p><b>Client:</b> ${client}</p>
        <p><b>Name:</b> ${name}<br/><b>Email:</b> ${email}<br/><b>Phone:</b> ${phone}</p>
        <p><b>Details:</b> ${material}, ${size}, ${stories} stories, ${urgency}${zip ? ", ZIP "+zip : ""}</p>
        ${estimate?.low ? `<p><b>Estimate:</b> $${estimate.low.toLocaleString()} – $${estimate.high.toLocaleString()}</p>` : ""}
      `;
      await resend.emails.send({
        from: "Leads <noreply@yourdomain.com>",
        to: ownerEmail,
        subject: "New Roofing Lead",
        html
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to handle lead" });
  }
}
