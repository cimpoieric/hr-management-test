/**
 * Application errors with stable codes for API + i18n mapping (errors.codes.*).
 */

export class AppError extends Error {
  public override readonly name = "AppError";

  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Canonical errors (fresh instance per property access - safe to throw).
 */
export const Errors = {
  get UNAUTHORIZED(): AppError {
    return new AppError("Unauthorized", "AUTH_001", 401);
  },
  get FORBIDDEN(): AppError {
    return new AppError("Forbidden", "AUTH_002", 403);
  },
  get ACCOUNT_INACTIVE(): AppError {
    return new AppError("Account disabled or removed", "AUTH_003", 403);
  },
  get NOT_FOUND(): AppError {
    return new AppError("Not found", "NOT_FOUND", 404);
  },
  get VALIDATION(): AppError {
    return new AppError("Validation error", "VALIDATION", 400);
  },
  get TENANT_ISOLATION(): AppError {
    return new AppError("Access denied", "TENANT_001", 403);
  },
  get CONFLICT(): AppError {
    return new AppError("Conflict", "CONFLICT", 409);
  },
  get BAD_REQUEST(): AppError {
    return new AppError("Bad request", "BAD_REQUEST", 400);
  },
  get INTERNAL(): AppError {
    return new AppError("Internal server error", "INTERNAL", 500);
  },
  get ONBOARDING_ALREADY(): AppError {
    return new AppError(
      "Onboarding already completed",
      "ONBOARDING_ALREADY",
      409,
    );
  },
  get CNP_DUPLICATE(): AppError {
    return new AppError(
      "This national ID is already registered",
      "CNP_DUPLICATE",
      409,
    );
  },
} as const;

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
