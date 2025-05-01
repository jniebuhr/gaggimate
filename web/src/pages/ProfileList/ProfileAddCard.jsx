import { useCallback, useState } from 'preact/hooks';

export function ProfileAddCard(props) {
  return (
    <a
      href="/profiles/new"
      className="relative rounded-lg border sm:col-span-12 flex flex-col gap-2 items-center justify-center border-slate-200 bg-white p-2 cursor-pointer text-slate-900 hover:bg-indigo-100 hover:text-indigo-600 active:border-indigo-200 dark:text-indigo-100 dark:bg-gray-800 dark:border-gray-600"
    >
      <i className="fa fa-plus text-3xl" />
      <span className="text-sm">Add new</span>
    </a>
  );
}
