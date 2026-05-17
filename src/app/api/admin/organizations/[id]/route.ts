import {
  deleteAdminOrganization,
  getOrganizationDetail,
  logAdminOrganizationAction,
  organizationPlanStatusUpdateSchema,
  organizationUpdateSchema,
  updateAdminOrganization,
  updateAdminOrganizationPlanStatus,
} from "@/lib/adminOrganizations";
import { withAdminApi } from "@/lib/adminApi";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const idSchema = z.string().cuid();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async (user) => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const organization = await getOrganizationDetail(parsedId.data);
    if (!organization) {
      return NextResponse.json(
        { error: "Organizatie negasita" },
        { status: 404 },
      );
    }

    logAdminOrganizationAction(request, user, "VIEW", organization);
    return NextResponse.json({ organization, data: organization });
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async (user) => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = organizationPlanStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await getOrganizationDetail(parsedId.data);
    if (!existing) {
      return NextResponse.json(
        { error: "Organizatie negasita" },
        { status: 404 },
      );
    }

    const organization = await updateAdminOrganizationPlanStatus(
      parsedId.data,
      parsed.data,
    );

    logAdminOrganizationAction(
      request,
      user,
      "UPDATE",
      {
        id: existing.id,
        name: organization?.name ?? existing.name,
        status: organization?.status ?? existing.status,
        plan: organization?.plan ?? existing.plan,
      },
      {
        organizationId: existing.id,
        plan: existing.plan,
        status: existing.status,
      },
      {
        organizationId: existing.id,
        plan: organization?.plan,
        status: organization?.status,
      },
    );

    return NextResponse.json({ organization, data: organization });
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async (user) => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = organizationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await getOrganizationDetail(parsedId.data);
    if (!existing) {
      return NextResponse.json(
        { error: "Organizatie negasita" },
        { status: 404 },
      );
    }

    try {
      const organization = await updateAdminOrganization(
        parsedId.data,
        parsed.data,
      );

      logAdminOrganizationAction(
        request,
        user,
        "UPDATE",
        {
          id: existing.id,
          name: organization?.name ?? existing.name,
          status: organization?.status ?? existing.status,
          plan: organization?.plan ?? existing.plan,
        },
        {
          organizationId: existing.id,
          name: existing.name,
          status: existing.status,
          plan: existing.plan,
        },
        {
          organizationId: existing.id,
          name: organization?.name,
          status: organization?.status,
          plan: organization?.plan,
        },
      );

      return NextResponse.json({ organization, data: organization });
    } catch (error: unknown) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code.includes("Unique")) {
        return NextResponse.json({ error: "Slug deja folosit" }, { status: 409 });
      }
      throw error;
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async (user) => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const result = await deleteAdminOrganization(parsedId.data);
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Organizatie negasita" },
          { status: 404 },
        );
      }
      if (result.reason === "PROTECTED_PLATFORM_ORG") {
        return NextResponse.json(
          {
            error:
              "Organizatia platformei (super administrator) nu poate fi stearsa",
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Stergerea este permisa doar pentru organizatiile in status trial",
        },
        { status: 403 },
      );
    }

    logAdminOrganizationAction(
      request,
      user,
      "DELETE",
      {
        id: result.organization.id,
        name: result.organization.name,
        status: result.organization.status,
        plan: result.organization.plan,
      },
      {
        organizationId: result.organization.id,
        name: result.organization.name,
        status: result.organization.status,
        plan: result.organization.plan,
        operation: "DELETE",
      },
      { organizationId: result.organization.id, deleted: true, operation: "DELETE" },
    );

    return NextResponse.json({ ok: true, deleted: true });
  });
}
