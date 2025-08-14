import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const { raw, rows } = await request.json().catch(() => ({ raw: null, rows: null }));
    const dataDir = path.join(process.cwd(), "data");
    const filePath = path.join(dataDir, "saves.json");
    await fs.mkdir(dataDir, { recursive: true });

    let existing: unknown[] = [];
    try {
      const text = await fs.readFile(filePath, "utf8");
      existing = JSON.parse(text);
      if (!Array.isArray(existing)) existing = [];
    } catch {}

    const record = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      raw,
      rows,
    };
    (existing as unknown[]).push(record);
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), "utf8");

    return NextResponse.json({ ok: true, id: record.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}


