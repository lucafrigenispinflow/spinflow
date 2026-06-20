export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl">🚴</div>
          <h1 className="text-2xl font-bold text-white">
            Spin<span className="text-violet-600">Flow</span>
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}
