import { NextRequest, NextResponse } from "next/server";
import { main as fetchFiiData } from "../../../../scripts/fetch-data-fundamentus-fii";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${process.env.FETCH_API_SECRET}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const originalArgv = process.argv;
    process.argv = ["node", "fetch-data-fundamentus-fii.ts"];

    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
      originalLog(...args);
    };
    console.error = (...args: unknown[]) => {
      logs.push(`ERROR: ${args.join(" ")}`);
      originalError(...args);
    };

    try {
      await fetchFiiData();
      console.log = originalLog;
      console.error = originalError;
      process.argv = originalArgv;

      return NextResponse.json({
        success: true,
        message: "Fetch de FIIs concluído",
        logs: logs.slice(-50),
      });
    } catch (error: unknown) {
      console.log = originalLog;
      console.error = originalError;
      process.argv = originalArgv;
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { success: false, error: message, logs: logs.slice(-50) },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST com Authorization: Bearer FETCH_API_SECRET",
  });
}
