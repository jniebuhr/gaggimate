import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'de', 'it', 'fr', 'es', 'ja', 'zh'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
    },
  ],
  // Source references without line numbers, so catalogs don't churn on unrelated edits.
  format: formatter({ lineNumbers: false }),
});
