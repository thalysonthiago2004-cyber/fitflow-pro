import { NextResponse, type NextRequest } from "next/server";
import { parseEmailOtpType } from "@/lib/auth/otp";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// Landing point for Supabase e-mail links (sign-up confirmation, recovery).
// Supports the PKCE `code` flow and the `token_hash` flow, which also works
// when the link is opened on a different device than the one that requested it.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = parseEmailOtpType(searchParams.get("type"));

  const supabase = await createClient();
  let verified = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    verified = !error;
  }

  const destination = verified ? next : "/auth/error";
  return NextResponse.redirect(new URL(destination, request.url));
}
