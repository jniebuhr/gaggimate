export function Footer() {
  return (
    <>
      <footer id="page-footer" className="flex grow-0 items-center">
        <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
          <div className="flex flex-col gap-2 border-t-2 border-slate-200/50 py-6 text-center text-sm font-medium text-slate-600 md:flex-row md:justify-between md:gap-0 md:text-start">
            <div className="inline-flex items-center justify-center">
              <span>Crafted with</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="mx-1 size-4 text-red-600"
              >
                <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 01-.69.001l-.002-.001z"></path>
              </svg>
              <span>
                {' '}
                in Italy by&nbsp;
                <a
                  className="font-medium text-indigo-600 transition hover:text-indigo-700"
                  href="https://gaggimate.eu"
                  target="_blank"
                >
                  Caffinnova S.r.l.
                </a>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
