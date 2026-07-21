import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ALDF_BACKEND_URL: process.env.ALDF_BACKEND_URL ?? "NOT SET",
    ALDF_SERVICE_JWT_SECRET: process.env.ALDF_SERVICE_JWT_SECRET ? "SET" : "NOT SET",
    SERVICE_JWT_SECRET: process.env.SERVICE_JWT_SECRET ? "SET" : "NOT SET",
  });
}
