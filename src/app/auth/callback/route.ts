import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/app/_supabase/server";
import { readSupabasePublicConfig } from "@/infrastructure/supabase/environment";

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/", request.url);
  const code = request.nextUrl.searchParams.get("code");

  if (!code || !readSupabasePublicConfig()) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("notice", "The confirmation link is invalid.");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set(
      "notice",
      "The confirmation link has expired.",
    );
  }

  return NextResponse.redirect(redirectUrl);
}
