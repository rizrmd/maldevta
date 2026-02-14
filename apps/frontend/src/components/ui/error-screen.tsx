export default function ErrorScreen({
  title = "Something went wrong",
  message,
  onRetry,
  onLogout,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onLogout?: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="mx-auto w-full max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-lg">
        {/* Error Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h4m-6 0v6m0 4h4m2 0v6m0 4h4m-6 0v6m0 4h4"
            />
          </svg>
        </div>

        {/* Error Text */}
        <h1 className="text-center text-xl font-semibold text-slate-900">{title}</h1>
        {message && (
          <p className="mt-2 text-center text-sm text-slate-600">{message}</p>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Try Again
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
