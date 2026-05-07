import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Alias: /api/email/config -> /api/email/settings
    const res = await fetch(new URL("/api/email/settings", request.url), {
      method: "GET",
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (error) {
    console.error("[SMTP_CONFIG_GET]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const res = await fetch(new URL("/api/email/settings", request.url), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (error) {
    console.error("[SMTP_CONFIG_PUT]", error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }
}

