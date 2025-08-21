export function NotFound() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <h1 className='text-base-content mb-4 text-6xl font-bold'>404</h1>
      <p className='text-base-content/70 mb-8 text-xl'>Page not found</p>
      <a href='/' className='btn btn-primary'>
        Go Home
      </a>
    </div>
  );
}
