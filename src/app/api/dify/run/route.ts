import { NextResponse } from "next/server";

const BASE_URL = (process.env.DIFY_API_BASE_URL || "https://api.dify.ai").replace(/\/$/, "");
const API_KEY = process.env.DIFY_API_KEY || "";
const WORKFLOW_ID = process.env.DIFY_WORKFLOW_ID || "";
const RUN_ENDPOINT = process.env.WORKFLOW_RUN_ENDPOINT || "/v1/workflows/run";

export async function POST(req: Request) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ ok: false, error: "DIFY_API_KEY is not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const inputs = body.inputs ?? {};
    const response_mode: "blocking" | "streaming" = body.response_mode ?? "blocking";
    const user: string = body.user ?? "web-user";
    const workflow_id = body.workflow_id ?? WORKFLOW_ID;
    const files = body.files; // optional: pass-through

    const path = RUN_ENDPOINT.startsWith("/") ? RUN_ENDPOINT : `/${RUN_ENDPOINT}`;
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url , {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ inputs, response_mode, user, workflow_id, files }),
      // Dify often needs no-store to avoid edge caching
      cache: "no-store" as any,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}


