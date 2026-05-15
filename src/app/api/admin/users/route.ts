import { listAdminUsers } from "@/lib/adminUsers";
import { withAdminApi } from "@/lib/adminApi";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const { searchParams } = request.nextUrl;
    const users = await listAdminUsers({
      search: searchParams.get("search") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      organizationId: searchParams.get("organizationId") ?? undefined,
    });

    return NextResponse.json({ users, data: users });
  });
}
