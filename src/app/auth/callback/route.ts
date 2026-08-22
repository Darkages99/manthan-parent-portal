import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Receives the redirect back from Supabase after an OAuth (Google) sign-in.
// Supabase appends a `code` query param that we exchange server-side for a
// session, which sets the auth cookies via the server client's cookie
// adapter, then we hand the browser off to /post-login, which routes
// guardians to /home and staff to /console.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/post-login", request.url));
    }
  }

  return NextResponse.redirect(new URL("/?error=auth", request.url));
}
