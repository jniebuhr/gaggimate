import { Trans } from '@lingui/react/macro';

export function NotFound() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <h1 className='text-base-content mb-4 text-6xl font-bold'>404</h1>
      <p className='text-base-content/70 mb-8 text-xl'>
        <Trans>Page not found</Trans>
      </p>
      <a href='/' className='btn btn-primary'>
        <Trans>Go Home</Trans>
      </a>
    </div>
  );
}
