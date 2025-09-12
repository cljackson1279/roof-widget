// /api/lead.js  (CommonJS)
// Validates required fields, saves to Supabase, emails via Resend, SMS via Twilio, optional webhook to CRM

let createClient = null;
let Resend = null;
let twilio = null;

try { ({ createClient } = require("@supabase/supabase-js")); } catch (_){}
try { ({ Resend } = require("resend")); } catch (_){}
try { twilio = require("twilio"); } catch (_){}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;
const LEAD_WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL;

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const ua = req.headers["user-agent"] || "";
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket?.remoteAddress || "";

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
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
      estimate = null
    } = body;

    // ---- Basic validation (required fields)
    if (!name.trim() || !email.trim() || !phone.trim()) {
      return res.status(400).json({ error: "Name, email, and phone are required." });
    }

    // ---- Lightweight spam/abuse guard (optional)
    if (!email.includes("@") || email.endsWith("@example.com")) {
      return res.status(400).json({ error: "Invalid email." });
    }

    // ---- Save to Supabase
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE;
    let leadRow = null;

    if (sbUrl && sbKey && createClient) {
      const sb = createClient(sbUrl, sbKey);

      // Fetch client owner for notifications
      const { data: clientRow } = await sb
        .from("clients")
        .select("owner_email, owner_phone")
        .eq("client_id", client)
        .maybeSingle();

      const est_low = estimate?.low || null;
      const est_high = estimate?.high || null;

      const { data: saved, error: saveErr } = await sb
        .from("leads")
        .insert([{
          client_id: client,
          name, email, phone, zip, city, county, state,
          material, size, stories, urgency,
          est_low, est_high,
          source_ip: ip,
          user_agent: ua
        }])
        .select()
        .single();

      if (saveErr) console.error("Supabase save error:", saveErr);
      leadRow = saved || null;

      // ---- Email notification (Resend)
      if (clientRow?.owner_email && RESEND_API_KEY && Resend) {
        const resend = new Resend(RESEND_API_KEY);
        const subject = `New Roofing Lead (${client}) — ${name}`;
        const html = `
          <h2>New Roofing Lead</h2>
          <p><b>Client:</b> ${client}</p>
          <p><b>Name:</b> ${name}<br/>
             <b>Email:</b> ${email}<br/>
             <b>Phone:</b> ${phone}</p>
          <p><b>Location:</b> ${zip || ""} ${city || ""} ${state || ""} ${county ?

