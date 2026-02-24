import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const n = body?.n;
    const edges = body?.edges;

    if (typeof n !== "number" || !Array.isArray(edges)) {
      return NextResponse.json({ error: "Bad input" }, { status: 400 });
    }

    const payload = JSON.stringify({ n, edges });

    const venvPy = join(process.cwd(), ".venv", "bin", "python");
    const py = process.env.PYTHON ?? (existsSync(venvPy) ? venvPy : "python3");
    const script = "scripts/autgroup.py";

    const stdout: string = await new Promise((resolve, reject) => {
      const child = execFile(py, [script], { maxBuffer: 10 * 1024 * 1024 }, (err, out, errOut) => {
        if (err) reject(new Error(errOut || err.message));
        else resolve(out);
      });
      child.stdin?.write(payload);
      child.stdin?.end();
    });

    const parsed = JSON.parse(stdout);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
