import { getGlobalAdminStats } from "@/lib/adminStats";
import { withAdminApi } from "@/lib/adminApi";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const stats = await getGlobalAdminStats();

    return NextResponse.json({
      stats,
      data: stats,
      organizationCount: stats.organizationCount,
      userCount: stats.userCount,
      employeeCount: stats.employeeCount,
    });
  });
}
