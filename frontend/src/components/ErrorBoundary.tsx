import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Trash2, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorageAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4EFEA] flex items-center justify-center p-4 font-sans text-[#1E1C1A]">
          <div className="max-w-xl w-full bg-[#FAF6F0] rounded-3xl border border-[#E5DEC9] p-8 sm:p-10 shadow-xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#D97706]/10 border border-[#D97706]/30 flex items-center justify-center mx-auto mb-5 text-[#B45309]">
              <AlertTriangle className="w-8 h-8 text-[#C2410C]" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold font-mono text-[#1E1C1A] mb-2">
              Log Pose Terminal Encountered an Error
            </h1>
            <p className="text-xs sm:text-sm text-[#78716C] mb-6 leading-relaxed">
              An unexpected display exception occurred during component render. Your stored session and credentials remain safe.
            </p>

            {this.state.error && (
              <div className="bg-[#F0ECE1] rounded-2xl border border-[#DDD5C7] p-4 mb-6 text-left overflow-auto max-h-48">
                <div className="text-[11px] font-mono font-bold text-[#C2410C] mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </div>
                {this.state.error.stack && (
                  <pre className="text-[10px] font-mono text-[#78716C] whitespace-pre-wrap overflow-x-auto">
                    {this.state.error.stack.split("\n").slice(0, 5).join("\n")}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-semibold bg-[#C2410C] hover:bg-[#9A3412] text-white transition-colors cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleClearStorageAndReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-medium bg-[#EAE3D2] hover:bg-[#DFD7C2] text-[#1E1C1A] border border-[#DDD5C7] transition-colors cursor-pointer"
                title="Clears local cache and reloads cleanly"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#C2410C]" />
                <span>Clear Cache & Reload</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
