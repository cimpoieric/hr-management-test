import { withAdminApi } from "@/lib/adminApi";
import { superAdminDeletionForbiddenResponse } from "@/lib/protectedSuperAdminApi";
import { prismaBase as prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const idSchema = z.string().cuid();

const updateSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
});

function mapAdminUser(entry: {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  organization: { name: string };
}) {
  return {
    id: entry.id,
    name: entry.name,
    email: entry.email,
    role: entry.role,
    organizationId: entry.organizationId,
    organizationName: entry.organization.name,
    isActive: entry.isActive,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async () => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const entry = await prisma.user.findUnique({
      where: { id: parsedId.data },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Utilizator negasit" }, { status: 404 });
    }

    const user = mapAdminUser(entry);
    return NextResponse.json({ user, data: user });
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async () => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Date invalide", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: parsedId.data },
    });
    if (!existing) {
      return NextResponse.json({ error: "Utilizator negasit" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: parsedId.data },
      data: {
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    });

    const user = mapAdminUser(updated);
    return NextResponse.json({ user, data: user });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminApi(request, async (actor) => {
    const { id } = await params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID invalid" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: parsedId.data },
    });
    if (!existing) {
      return NextResponse.json({ error: "Utilizator negasit" }, { status: 404 });
    }

    if (existing.id === actor.userId) {
      return NextResponse.json(
        { error: "Nu poti sterge propriul cont" },
        { status: 400 },
      );
    }

    const blocked = superAdminDeletionForbiddenResponse(existing);
    if (blocked) return blocked;

    await prisma.user.delete({ where: { id: parsedId.data } });
    return NextResponse.json({ ok: true, deleted: true });
  });
}
