export function NotFound() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
      <div className="sm:col-span-12 flex flex-col justify-center h-full items-center">
        <h1 className="text-8xl font-logo my-12 font-medium">404</h1>
        <p>The page you were looking for is not available.</p>
        <a href="/" className="menu-button my-4">
          Back
        </a>
      </div>
    </div>
  );
}
