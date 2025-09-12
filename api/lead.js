// /api/lead.js  (CommonJS for Vercel)
// Validates required fields, saves to Supabase, emails via Resend, SMS via Twilio, optional webhook to CRM

// Optional requires — safe even if packages are not installed
let createClient = null;
let Resend = null;
let twilio = null;

try { ({ createClient } = require("@supabase/supabase-js")); } catch (_) {}
try { ({ Resend } = require("resend")); } catch (_) {}
try { twilio = require("twilio"); } catch (_) {}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TWILIO_SID     = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM    = process.env.TWILIO_FROM_NUMBER;
const LEAD_WEBHOOK   = process.env.LEAD_WEBHOOK_URL; // optional

const FROM_EMAIL = "leads@yourdomain.com"; // MUST be a verified sender/domain in Resend

function sanitizePhone(p) {
  return (p || "").replace(/[^\d+]/g, "");
}

module.exports = async (req, res) => {
  // ---- CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const ua = req.headers["user-agent"] || "";
    const ip = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || req.socket?.remoteAddress || "";

    // Parse JSON body
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const {
      client = "demo",
      name = "",
      email = "",
      phone = "",
      zip = "",
      city = "",
      county = "",
      state = "",
      material = "",
      size = "",
      stories = "",
      urgency = "",
      estimate = null,
      consent = true // set to false and enforce if you added a consent checkbox
    } = body;

    // ---- Validate required fields
    if (!name.trim() || !email.trim() || !phone.trim()) {
      return res.status(400).json({ error: "Name, email, and phone are required." });
    }
    if (!email.includes("@") || email.endsWith("@example.com")) {
      return res.status(400).json({ error: "Invalid email." });
    }
    if (!consent) {
      return res.status(400).json({ error: "Consent required." });
    }

    const phoneClean = sanitizePhone(phone);

    // ---- Save to Supabase
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE;
    let leadRow = null;
    let clientRow = null;

    if (sbUrl && sbKey && createClient) {
      const sb = createClient(sbUrl, sbKey);

      // 1) Get client notification targets
      const { data: cRow, error: cErr } = await sb
        .from("clients")
        .select("owner_email, owner_phone")
        .eq("client_id", client)
        .maybeSingle();

      if (cErr) console.error("clients fetch error:", cErr);
      clientRow = cRow || {};

      // 2) Save lead
      const est_low  = estimate?.low ?? null;
      const est_high = estimate?.high ?? null;

      const { data: saved, error: saveErr } = await sb
        .from("leads")
        .insert([{
          client_id: client,
          name, email, phone: phoneClean, zip, city, county, state,
          material, size, stories, urgency,
          est_low, est_high,
          source_ip: ip,
          user_agent: ua
        }])
        .select()
        .single();

      if (saveErr) console.error("Supabase save error:", saveErr);
      leadRow = saved || {
        client_id: client, name, email, phone: phoneClean, zip, city, county, state,
        material, size, stories, urgency, est_low, est_high
      };
    } else {
      // If Supabase not configured, continue with notifications so you can still test
      leadRow = {
        client_id: client, name, email, phone: phoneClean, zip, city, county, state,
        material, size, stories, urgency,
        est_low: estimate?.low ?? null,
        est_high: estimate?.high ?? null
      };
      clientRow = { owner_email: null, owner_phone: null };
    }

    // ---- Email notification (Resend)
    if (clientRow.owner_email && RESEND_API_KEY && Resend) {
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
          <p style="font-size:12px;color:#6b7280">IP: ${ip} • UA: ${ua}</p>
        `;

        await resend.emails.send({
          from: FROM_EMAIL,        // must be a verified domain/sender in Resend
          to: clientRow.owner_email,
          subject,
          html
        });
      } catch (e) {
        console.error("Resend email error:", e);
      }
    }

    // ---- SMS notification (Twilio) — notification-only (one-way)
    if (clientRow.owner_phone && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && twilio) {
      try {
        const clientTw = twilio(TWILIO_SID, TWILIO_TOKEN);
        const msg = `📩 New Roofing Lead (${leadRow.client_id})
Name: ${leadRow.name}
Phone: ${leadRow.phone}
ZIP: ${leadRow.zip || ""}  City: ${leadRow.city || ""}
Est: ${
  leadRow.est_low && leadRow.est_high
    ? `$${Number(leadRow.est_low).toLocaleString()}–$${Number(leadRow.est_high).toLocaleString()}`
    : "N/A"
}
Material: ${leadRow.material || "-"} | Stories: ${leadRow.stories || "-"} | Urgency: ${leadRow.urgency || "-"}
👉 Call now!`;

        await clientTw.messages.create({
          body: msg,
          from: TWILIO_FROM,
          to: clientRow.owner_phone
        });
      } catch (e) {
        console.error("Twilio SMS error:", e);
      }
    }

    // ---- Optional: push to CRM via webhook (Zapier/Make)
    if (LEAD_WEBHOOK) {
      try {
        await fetch(LEAD_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "roof-widget",
            client_id: leadRow.client_id,
            name: leadRow.name,
            email: leadRow.email,
            phone: leadRow.phone,
            location: { zip: leadRow.zip, city: leadRow.city, county: leadRow.county, state: leadRow.state },
            project: { material: leadRow.material, size: leadRow.size, stories: leadRow.stories, urgency: leadRow.urgency },
            estimate: { low: leadRow.est_low, high: leadRow.est_high },
            meta: { ip, ua }
          })
        });
      } catch (e) {
        console.error("Webhook push error:", e);
      }
    }

    // ---- Done
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("lead error:", e);
    return res.status(500).json({ error: "Failed to handle lead" });
  }
};

