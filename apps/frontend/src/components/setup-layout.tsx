export default function SetupLayout({
  children,
  header,
}: {
  children?: React.ReactNode;
  header?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      {header && (
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 bg-white border-b border-slate-200">
          {header}
        </header>
      )}

      {/* Main Content */}
      <div className="flex flex-1 pt-4 px-4 overflow-auto">
        <main className="w-full">{children}</main>
      </div>
    </div>
  );
}
