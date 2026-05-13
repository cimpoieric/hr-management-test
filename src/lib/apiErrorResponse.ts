import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAppError, type AppError, Errors } from "@/lib/errors";
import { resolveRequestLocale } from "@/lib/requestLocale";
import { serverT } from "@/lib/serverTranslation";

function translationKeyForCode(code: string): string {
  return `errors.codes.${code}`;
}

export function translateAppError(request: NextRequest, err: AppError): string {
  const lng = resolveRequestLocale(request);
  const key = translationKeyForCode(err.code);
  const translated = serverT(lng, key);
  return translated === key ? err.message : translated;
}

export function jsonForAppError(
  request: NextRequest,
  err: AppError,
): NextResponse {
  return NextResponse.json(
    { error: translateAppError(request, err), code: err.code },
    { status: err.statusCode },
  );
}

export function unauthorizedJson(request: NextRequest): NextResponse {
  return jsonForAppError(request, Errors.UNAUTHORIZED);
}

export function forbiddenJson(request: NextRequest): NextResponse {
  return jsonForAppError(request, Errors.FORBIDDEN);
}

/**
 * Maps thrown values to a JSON error response with translated `error` string.
 */
export function toApiErrorResponse(
  request: NextRequest,
  error: unknown,
): NextResponse {
  const lng = resolveRequestLocale(request);

  if (isAppError(error)) {
    return jsonForAppError(request, error);
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: serverT(lng, "errors.codes.VALIDATION"),
        code: "VALIDATION",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof Error) {
    console.error("[API]", error);
    return NextResponse.json(
      {
        error: serverT(lng, "errors.codes.INTERNAL"),
        code: "INTERNAL",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      error: serverT(lng, "errors.codes.UNKNOWN"),
      code: "UNKNOWN",
    },
    { status: 500 },
  );
}

/**
 * Wrap an API route body: uncaught errors become translated JSON responses.
 */
export async function runApi(
  request: NextRequest,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return toApiErrorResponse(request, error);
  }
}
