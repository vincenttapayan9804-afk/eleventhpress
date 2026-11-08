import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/google-oauth";

/** GET — which optional sign-in methods this deployment offers. */
export async function GET() {
  return NextResponse.json({ google: googleConfigured(), passkeys: true, orcid: true });
}
