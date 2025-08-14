import { NextResponse } from "next/server";

const BASE_URL = (process.env.DIFY_API_BASE_URL || "https://api.dify.ai").replace(/\/$/, "");
const API_KEY = process.env.DIFY_API_KEY || "";
const DETAIL_TEMPLATE = process.env.WORKFLOW_DETAIL_ENDPOINT || "/v1/workflows/run/{workflow_run_id}";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ ok: false, error: "DIFY_API_KEY is not configured" }, { status: 500 });
    }
    const id = params.id;
    const path = DETAIL_TEMPLATE.replace("{workflow_run_id}", encodeURIComponent(id));
    const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store" as any,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}


