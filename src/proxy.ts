import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed the `middleware` file convention to `proxy`
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
// Runs before matched routes and refreshes the Supabase auth cookie so Server
// Components / Actions read a valid (or cleanly expired) session. Access control
// itself still lives in the layouts, getViewer(), and Postgres RLS.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except API route handlers, Next internals, PWA/static scripts,
    // and any file with an extension (icons, manifest, images, sw.js, …).
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|brand/|.*\\.[\\w]+$).*)",
  ],
};
