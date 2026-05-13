"use client";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Component, type ErrorInfo } from "react";
import { useTranslation } from "@/hooks/useTranslation";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

function ErrorFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          {t("error.title")}
        </h1>
        <p className="text-sm text-slate-600">{t("error.description")}</p>
        {process.env.NODE_ENV === "development" && (
          <pre className="max-h-32 w-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-xs text-red-800">
            {error.message}
          </pre>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="outline" onClick={onReset}>
          {t("error.retry")}
        </Button>
        <Button type="button" asChild>
          <Link href={ROUTES.dashboard}>{t("error.goToDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Catches render errors in the subtree and shows a friendly recovery UI (via `t()`).
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      );
    }
    return this.props.children;
  }
}
