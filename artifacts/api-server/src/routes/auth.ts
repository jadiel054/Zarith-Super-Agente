import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { SendOtpBody, VerifyOtpBody } from "@workspace/api-zod";

const router = Router();

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

router.post("/send-otp", async (req, res) => {
  const body = SendOtpBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ success: false, message: "Invalid email address" });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: body.data.email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    res.json({ success: true, message: "OTP transmitted to secure relay. Check your email." });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to send OTP" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const body = VerifyOtpBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ success: false, message: "Invalid request" });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: body.data.email,
      token: body.data.token,
      type: "email",
    });

    if (error || !data.session) {
      res.status(401).json({ success: false, message: error?.message || "Invalid or expired OTP" });
      return;
    }

    res.json({
      success: true,
      userId: data.user?.id ?? null,
      email: data.user?.email ?? null,
      accessToken: data.session.access_token,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to verify OTP" });
  }
});

export default router;
