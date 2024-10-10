import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// A faulty API route to test Sentry's error monitoring
export default async function GET() {
  throw new Error("Sentry Example API Route Error");
  return NextResponse.json({ data: "Testing Sentry Error..." });
}
