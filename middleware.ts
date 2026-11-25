import { NextResponse, type NextRequest } from "next/server";
import { auth } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const login = pathname === "/sign-in" || pathname === "/sign-up";
  const active = await auth().api.getSession({ headers: request.headers });
  if (active && login) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (!active && !login) return NextResponse.redirect(new URL("/sign-in", request.url));
  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/dashboard/:path*", "/transactions/:path*", "/accounts/:path*", "/budgets/:path*",
    "/reports/:path*", "/import/:path*", "/settings/:path*", "/recurring/:path*", "/sign-in", "/sign-up",
  ],
};
