import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE_URL = (process.env.DIFY_API_BASE_URL || "https://api.dify.ai").replace(/\/$/, "");
const API_KEY = process.env.DIFY_API_KEY || "";

export async function POST(req: Request) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ ok: false, error: "DIFY_API_KEY is not configured" }, { status: 500 });
    }

    const form = await req.formData();
    // accept both 'files' and 'file'
    let files = form.getAll("files");
    if (files.length === 0) {
      const single = form.get("file");
      if (single) files = [single];
    }
    if (files.length === 0) {
      return NextResponse.json({ ok: false, error: "no files provided" }, { status: 400 });
    }

    const uploadOne = async (file: any) => {
      const fd = new FormData();
      // Dify側のフィールド名は 'file'
      fd.append("file", file as any, (file as any)?.name || "upload.png");
      // 一部の環境ではpurposeが必要
      fd.append("purpose", "workflow");
      const res = await fetch(`${BASE_URL}/v1/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      return data;
    };

    const results = await Promise.all(files.map((f) => uploadOne(f)));
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}


