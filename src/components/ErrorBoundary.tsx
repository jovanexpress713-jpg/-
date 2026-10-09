import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  /** Optional reporter so a fatal render error also reaches the boot surface. */
  onError?: (error: Error, errorInfo?: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[EJAZ Enterprise System] Uncaught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full min-h-[300px] flex-col items-center justify-center bg-[#070b14] p-6 text-center text-white" dir="rtl">
          <div className="w-full max-w-md rounded-panel border border-slate-800 bg-[#0c1424] p-6 shadow-2xl space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-panel bg-brand/20 text-brand">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h2 className="text-section-title font-bold text-white">
                {this.props.fallbackTitle || "حدث خطأ غير متوقع في العرض"}
              </h2>
              <p className="mt-1 text-label-lg text-slate-400 leading-relaxed">
                تم حفظ حالة المنظومة بأمان. يرجى إعادة تحميل الشاشة للمتابعة.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="rounded-inner bg-slate-900/90 p-3 text-label font-mono text-red-300 border border-slate-800 text-start break-all" dir="ltr">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full h-11 rounded-inner bg-brand font-bold text-navy hover:brightness-110 active:scale-95 transition-all text-body"
            >
              إعادة تحميل الواجهة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
