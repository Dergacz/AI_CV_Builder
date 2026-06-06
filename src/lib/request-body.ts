export type BoundedJsonResult = { ok: true; body: unknown } | { ok: false; status: 400 | 413 };

export async function readBoundedJson(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
  let buffer: ArrayBuffer;
  try {
    buffer = await request.arrayBuffer();
  } catch {
    return { ok: false, status: 400 };
  }

  if (buffer.byteLength > maxBytes) {
    return { ok: false, status: 413 };
  }

  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(buffer)) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
