// /api/lead.js

const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");
const twilio = require("twilio");

// ---- Env Vars (set these in Vercel → Settings → Environment Variables)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "support@leadshingle.com"; // ✅ verified domain
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      client,
      name,
      email,
      phone,
      zip,
      city,
      county,
      state,
      material,
      size,
      stories,
      urgency,
      estimate,
      consent
    } = req.body;

    if (!consent) {
      return res.status(400).json({ error: "Consent required" });
    }

    // ---- Insert into Supabase
    const { data: leadRow, error: insertErr } = await sb
      .from("leads")
      .insert([
        {
          client_id: client,
          name,
          email,
          phone,
          zip,
          city,
          county,
          state,
          material,
          size,
          stories,
          urgency,
          est_low: estimate?.low || null,
          est_high: estimate?.high || null,
          source_ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
          user_agent: req.headers["user-agent"]
        }
      ])
      .select("*")
      .single();

    if (insertErr) {
      console.error("Supabase insert error:", insertErr);
      return res.status(500).json({ error: "Failed to save lead" });
    }

    // ---- Get client notification info
    const { data: clientRow, error: clientErr } = await sb
      .from("clients")
      .select("owner_email, owner_phone")
      .eq("client_id", client)
      .maybeSingle();

    if (clientErr || !clientRow) {
      console.warn("No clientRow found for", client);
    }

    // ---- Email notification (Resend)
    if (clientRow?.owner_email && RESEND_API_KEY) {
      try {
        const resend = new Resend(RESEND_API_KEY);
        const subject = `📩 New Roofing Lead (${leadRow.client_id}) — ${leadRow.name}`;
        const html = `
          <h2>New Roofing Lead</h2>
          <p><b>Client:</b> ${leadRow.client_id}</p>
          <p><b>Name:</b> ${leadRow.name}<br/>
             <b>Email:</b> ${leadRow.email}<br/>
             <b>Phone:</b> ${leadRow.phone}</p>
          <p><b>Location:</b> ${leadRow.zip || ""} ${leadRow.city || ""} ${leadRow.state || ""} ${leadRow.county || ""}</p>
          <p><b>Estimate:</b> ${
            leadRow.est_low && leadRow.est_high
              ? `$${Number(leadRow.est_low).toLocaleString()} – $${Number(leadRow.est_high).toLocaleString()}`
              : "N/A"
          }</p>
          <p><b>Material:</b> ${leadRow.material || "-"} |
             <b>Stories:</b> ${leadRow.stories || "-"} |
             <b>Urgency:</b> ${leadRow.urgency || "-"}</p>
          <hr/>
          <p style="font-size:12px;color:#6b7280">
            IP: ${req.headers["x-forwarded-for"] || req.socket.remoteAddress} • 
            UA: ${req.headers["user-agent"]}
          </p>
        `;

        await resend.emails.send({
          from: FROM_EMAIL,                // ✅ must be @leadshingle.com
          to: clientRow.owner_email,       // Roofer’s email from Supabase
          subject,
          html
        });
      } catch (e) {
        console.error("Resend email error:", e);
      }
    }

    // ---- SMS notification (Twilio)
    if (clientRow?.owner_phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        const clientTw = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const msg = `📩 New Roofing Lead (${leadRow.client_id})
${leadRow.name} • ${leadRow.phone}
${[leadRow.zip, leadRow.city, leadRow.state].filter(Boolean).join(" ")}
Est: ${
          leadRow.est_low && leadRow.est_high
            ? `$${Number(leadRow.est_low).toLocaleString()} – $${Number(
                leadRow.est_high
              ).toLocaleString()}`
            : "N/A"
        }
${leadRow.material || "-"} • ${leadRow.stories || "-"} stories • ${leadRow.urgency || "-"}
Reply STOP to opt out. HELP for help.`;

        await clientTw.messages.create({
          body: msg,
          to: clientRow.owner_phone,
          messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID // ✅ A2P route
        });
      } catch (e) {
        console.error("Twilio SMS error:", e);
      }
    }

    return res.status(200).json({ ok: true, lead: leadRow });
  } catch (e) {
    console.error("lead.js error:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
};

