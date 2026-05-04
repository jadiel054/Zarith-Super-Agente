import { Router } from "express";
import { SendOtpBody, VerifyOtpBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

// ─── Local OTP store (used when Supabase is not configured) ─────────────────
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5; // Max attempts before locking an email
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  lockedUntil: number;
}

const localOtpStore = new Map<string, OtpEntry>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

// ─── Routes ─────────────────────────────────────────────────────────────────

router.post("/send-otp", async (req, res) => {
  const body = SendOtpBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ success: false, message: "Invalid email address" });
    return;
  }

  const { email } = body.data;

  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      res.json({ success: true, message: "OTP transmitted. Check your email." });
    } catch (err: any) {
      logger.error({ err }, "Supabase send-otp error");
      res.status(500).json({ success: false, message: err?.message ?? "Unknown error" });
    }
    return;
  }

  // ── Local mode ──────────────────────────────────────────────────────────
  const code = generateOtp();
  localOtpStore.set(email, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0, // Reset attempts on new OTP request
    lockedUntil: 0, // Reset lock on new OTP request
  });

  logger.info(`
${"═".repeat(50)}
  ZARITH LOCAL AUTH — OTP for ${email}
  CODE: ${code}
${"═".repeat(50)}
`);

  res.json({
    success: true,
    message: "Local mode: check the API server console for your OTP code.",
  });
});

router.post("/verify-otp", async (req, res) => {
  const body = VerifyOtpBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ success: false, message: "Invalid request" });
    return;
  }

  const { email, token } = body.data;

  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error || !data.session) {
        res.status(401).json({ success: false, message: error?.message ?? "Invalid or expired OTP" });
        return;
      }
      res.json({
        success: true,
        userId: data.user?.id ?? null,
        email: data.user?.email ?? null,
        accessToken: data.session.access_token,
      });
    } catch (err: any) {
      logger.error({ err }, "Supabase verify-otp error");
      res.status(500).json({ success: false, message: err?.message ?? "Unknown error" });
    }
    return;
  }

  // ── Local mode ──────────────────────────────────────────────────────────
  const entry = localOtpStore.get(email);
  const now = Date.now();

  if (!entry) {
    res.status(401).json({ success: false, message: "No OTP found for this address. Request a new one." });
    return;
  }

  if (entry.lockedUntil > now) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    res.status(429).json({
      success: false,
      message: `Too many failed attempts. Please try again in ${remainingSeconds} seconds.`,
    });
    return;
  }

  if (now > entry.expiresAt) {
    localOtpStore.delete(email);
    res.status(401).json({ success: false, message: "OTP expired. Request a new one." });
    return;
  }

  if (entry.code !== token) {
    entry.attempts++;
    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_DURATION_MS;
      logger.warn(`Email ${email} locked for ${LOCKOUT_DURATION_MS / 1000} seconds due to too many failed OTP attempts.`);
      res.status(429).json({
        success: false,
        message: `Too many failed attempts. Email locked for ${LOCKOUT_DURATION_MS / 1000} seconds.`,
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid authorization code." });
    }
    localOtpStore.set(email, entry); // Update the entry in the store
    return;
  }

  // OTP is valid
  localOtpStore.delete(email); // Invalidate OTP after successful use

  // Return a simple non-JWT session token — the frontend trusts non-JWT tokens indefinitely
  const sessionToken = `zarith_local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  res.json({
    success: true,
    userId: null,
    email,
    accessToken: sessionToken,
  });
});

export default router;
