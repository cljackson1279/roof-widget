module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    env: {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
      TWILIO_FROM_NUMBER: !!process.env.TWILIO_FROM_NUMBER,
      LEAD_WEBHOOK_URL: !!process.env.LEAD_WEBHOOK_URL
    }
  });
};
