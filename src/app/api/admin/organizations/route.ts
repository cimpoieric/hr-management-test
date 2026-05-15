import { listAdminOrganizations } from "@/lib/adminOrganizations";
import { withAdminApi } from "@/lib/adminApi";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const { searchParams } = request.nextUrl;
    const organizations = await listAdminOrganizations({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      plan: searchParams.get("plan") ?? undefined,
    });

    return NextResponse.json({ organizations, data: organizations });
  });
}
