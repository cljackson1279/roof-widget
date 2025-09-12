// /api/lead.js

const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");
const twilio = require("twilio");

// ---------- Env Vars (set in Vercel → Project → Settings → Environment Variables)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "support@leadshingle.com"; // must be @leadshingle.com (verified in Resend)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID; // MGXXXXXXXX...
// ------------------------------------------------------------------------------

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Helper: normalize phone to E.164 (US)
function toE164US(p) {
  if (!p) return null;
  const s = String(p).trim();
  if (s.startsWith("+") && /^\+\d{10,15}$/.test(s)) return s;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  return null;
}

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
    } = req.body || {};

    // ---- Basic validation
    if (!client) return res.status(400).json({ error: "Missing client" });
    if (!consent) return res.status(400).json({ error: "Consent required" });
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Name, email, and phone are required" });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const ua = req.headers["user-agent"] || "";

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
          est_low: estimate?.low ?? null,
          est_high: estimate?.high ?? null,
          source_ip: ip,
          user_agent: ua
        }
      ])
      .select("*")
      .single();

    if (insertErr) {
      console.error("Supabase insert error:", insertErr);
      return res.status(500).json({ error: "Failed to save lead" });
    }

    // ---- Fetch client notification targets
    const { data: clientRow, error: clientErr } = await sb
      .from("clients")
      .select("owner_email, owner_phone, client_id")
      .eq("client_id", client)
      .maybeSingle();

    if (clientErr) {
      console.error("Client fetch error:", clientErr);
    }
    if (!clientRow) {
      console.warn("No client row found for", client);
    }

    // ---- Build common fields
    const locationLine = [city, state, zip, county && `(${county} County)`].filter(Boolean).join(" • ");
    const estDisplay =
      leadRow.est_low && leadRow.est_high
        ? `$${Number(leadRow.est_low).toLocaleString()} – $${Number(leadRow.est_high).toLocaleString()}`
        : "N/A";

    // ===========================
    // Email notification (Resend)
    // ===========================
    if (clientRow?.owner_email && RESEND_API_KEY) {
      try {
        const resend = new Resend(RESEND_API_KEY);

        const fromName = "LeadShingle Alerts";
        const subject = `📩 New Roofing Lead — ${leadRow.name} (${leadRow.client_id})`;
        const preheader =
          `${leadRow.name} • ${leadRow.phone || ""} • ` +
          `${[leadRow.city, leadRow.state, leadRow.zip].filter(Boolean).join(", ")}`;

        const callHref = leadRow.phone ? `tel:${String(leadRow.phone).replace(/[^\d+]/g, "")}` : "#";
        const emailHref = leadRow.email ? `mailto:${leadRow.email}?subject=Roofing%20Estimate` : "#";
        const mapHref =
          zip || city || state
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [city, state, zip].filter(Boolean).join(" ")
              )}`
            : "#";

        const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,sans-serif;max-width:640px;margin:0 auto;padding:16px;color:#111">
  <!-- preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>

  <h1 style="margin:0 0 12px;font-size:20px">New Roofing Lead</h1>
  <p style="margin:0 0 16px;color:#6b7280">Source: <b>${leadRow.client_id}</b></p>

  <table cellspacing="0" cellpadding="10" style="width:100%;border:1px solid #e5e7eb;border-radius:12px">
    <tr><td style="width:160px;"><b>Name</b></td><td>${leadRow.name}</td></tr>
    <tr><td><b>Email</b></td><td>${leadRow.email ? `<a href="${emailHref}">${leadRow.email}</a>` : "-"}</td></tr>
    <tr><td><b>Phone</b></td><td>${leadRow.phone ? `<a href="${callHref}">${leadRow.phone}</a>` : "-"}</td></tr>
    <tr><td><b>Location</b></td><td>${locationLine || "-"}</td></tr>
    <tr><td><b>Estimate</b></td><td>${estDisplay}</td></tr>
    <tr><td><b>Project</b></td><td>Material: ${material || "-"} • Stories: ${stories || "-"} • Urgency: ${urgency || "-"}</td></tr>
  </table>

  <div style="display:flex;gap:8px;margin-top:14px">
    <a href="${callHref}" style="text-decoration:none;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px">📞 Call</a>
    <a href="${emailHref}" style="text-decoration:none;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px">✉️ Email</a>
    <a href="${mapHref}" style="text-decoration:none;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px">🗺️ Map</a>
  </div>

  <p style="font-size:12px;color:#9ca3af;margin-top:12px">
    IP: ${ip} • UA: ${ua}
  </p>
</div>
        `;

        await resend.emails.send({
          from: `${fromName} <${FROM_EMAIL}>`,    // e.g., "LeadShingle Alerts <support@leadshingle.com>"
          to: clientRow.owner_email,              // roofer recipient (from Supabase)
          reply_to: leadRow.email || undefined,   // replying goes to the homeowner
          subject,
          html,
          tags: [
            { name: "source", value: "roof-widget" },
            { name: "client", value: String(leadRow.client_id || "unknown") }
          ]
        });
      } catch (e) {
        console.error("Resend email error:", e);
      }
    }

    // =========================
    // SMS notification (Twilio)
    // =========================
    if (clientRow?.owner_phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        const ownerTo = toE164US(clientRow.owner_phone);
        if (!ownerTo) {
          console.warn("Skipping SMS: invalid owner_phone", clientRow.owner_phone);
        } else {
          const clientTw = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
          const msg = `📩 New Roofing Lead (${leadRow.client_id})
${leadRow.name} • ${leadRow.phone}
${[leadRow.zip, leadRow.city, leadRow.state].filter(Boolean).join(" ")}
Est: ${estDisplay}
${material || "-"} • ${stories || "-"} stories • ${urgency || "-"}
Reply STOP to opt out. HELP for help.`;

          const payload = {
            body: msg,
            to: ownerTo
          };

          if (TWILIO_MESSAGING_SERVICE_SID) {
            payload.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID; // A2P-compliant route
          } else {
            // Fallback (not A2P compliant) — you can optionally support TWILIO_FROM_NUMBER
            const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
            if (TWILIO_FROM_NUMBER) payload.from = TWILIO_FROM_NUMBER;
          }

          await clientTw.messages.create(payload);
        }
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

