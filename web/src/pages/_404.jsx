import { t } from '@lingui/core/macro';

export function NotFound() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <h1 className='text-base-content mb-4 text-6xl font-bold'>{t`404`}</h1>
      <p className='text-base-content/70 mb-8 text-xl'>{t`Page not found`}</p>
      <a href='/' className='btn btn-primary'>
        {t`Go Home`}
      </a>
    </div>
  );
}
