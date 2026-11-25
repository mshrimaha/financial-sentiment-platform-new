import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveBackendOrigin(): string {
  const raw = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  // Avoid Windows Node.js resolving 'localhost' to IPv6 ::1 when uvicorn binds IPv4
  return raw.replace("://localhost:", "://127.0.0.1:").replace(/\/+$/, "");
}

async function proxy(request: NextRequest, context: { params: { path: string[] } }) {
  const origin = resolveBackendOrigin();
  const subpath = (context.params.path || []).join("/");
  const search = request.nextUrl.search || "";
  const targetUrl = `${origin}/${subpath}${search}`;

  const headers = new Headers();
  const forwardHeaders = ["authorization", "content-type", "accept"];
  for (const key of forwardHeaders) {
    const val = request.headers.get(key);
    if (val) headers.set(key, val);
  }

  let body: ArrayBuffer | undefined = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
    });

    const respHeaders = new Headers();
    const copyHeaders = ["content-type", "content-disposition", "cache-control"];
    for (const key of copyHeaders) {
      const val = upstream.headers.get(key);
      if (val) respHeaders.set(key, val);
    }

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err: any) {
    const code = err?.cause?.code || err?.code || "FETCH_FAILED";
    return NextResponse.json(
      {
        detail: `FinSentinel backend is unreachable at ${origin} (${code}). Start the FastAPI server (uvicorn app.main:app --host 0.0.0.0 --port 8000) and retry.`,
      },
      { status: 503 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
