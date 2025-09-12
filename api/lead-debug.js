// /api/lead-debug.js
let createClient = null; let Resend = null; let twilio = null;
try { ({ createClient } = require("@supabase/supabase-js")); } catch (_){}
try { ({ Resend } = require("resend")); } catch (_){}
try { twilio = require("twilio"); } catch (_){}

module.exports = async (req, res) => {
  try {
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE;
    const sb = (sbUrl && sbKey && createClient) ? createClient(sbUrl, sbKey) : null;

    // Read demo client
    let clientRow = null;
    if (sb) {
      const { data } = await sb.from("clients").select("owner_email, owner_phone").eq("client_id","demo").maybeSingle();
      clientRow = data;
    }

    // Minimal insert
    let ins = null, insErr = null;
    if (sb) {
      const r = await sb.from("leads").insert([{ client_id:"demo", name:"Debug User", email:"debug@example.com", phone:"+15555550123" }]).select("id").single();
      ins = r.data; insErr = r.error;
    }

    // Email test
    let emailTried=false, emailErr=null;
    if (clientRow?.owner_email && process.env.RESEND_API_KEY && Resend) {
      emailTried = true;
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "leads@yourdomain.com",
          to: clientRow.owner_email,
          subject: "Lead Debug Email",
          html: "<p>This is a test email from /api/lead-debug.</p>"
        });
      } catch (e) { emailErr = String(e); }
    }

    // SMS test
    let smsTried=false, smsErr=null;
    if (clientRow?.owner_phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER && twilio) {
      smsTried = true;
      try {
        const t = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await t.messages.create({
          body: "Lead Debug SMS from /api/lead-debug",
          from: process.env.TWILIO_FROM_NUMBER,
          to: clientRow.owner_phone
        });
      } catch (e) { smsErr = String(e); }
    }

    return res.status(200).json({ ok:true, clientRow, insert:{ins, insErr}, email:{tried:emailTried, error:emailErr}, sms:{tried:smsTried, error:smsErr} });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
};
