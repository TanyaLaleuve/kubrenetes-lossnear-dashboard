import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession();
  if (!session.loggedIn) {
    return new NextResponse(null, { status: 401 });
  }

  const { userId } = await params;
  const rows = await db()
    .select({ avatar: schema.users.avatar, updatedAt: schema.users.updatedAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const avatar = rows[0]?.avatar;
  if (!avatar) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(avatar), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=60",
    },
  });
}
