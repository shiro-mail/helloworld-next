import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), "data");
    const filePath = path.join(dataDir, "saves.json");
    const text = await fs.readFile(filePath, "utf8").catch(() => "[]");
    const json = JSON.parse(text);
    if (!Array.isArray(json)) return NextResponse.json([]);
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}


