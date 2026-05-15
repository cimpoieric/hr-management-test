import { getAdminDatabaseInfo } from "@/lib/adminDatabase";
import { withAdminApi } from "@/lib/adminApi";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const info = await getAdminDatabaseInfo();
    return NextResponse.json({ info });
  });
}
