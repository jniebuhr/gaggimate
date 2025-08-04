export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-6xl font-bold text-base-content mb-4">404</h1>
      <p className="text-xl text-base-content/70 mb-8">Page not found</p>
      <a href="/" className="btn btn-primary">
        Go Home
      </a>
    </div>
  );
}
