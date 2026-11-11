import preact from 'eslint-config-preact';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';

export default [
  {
    files: ['**/*.{js,jsx}'],
  },
  ...preact,
  {
    plugins: {
      'better-tailwindcss': betterTailwindcss,
    },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/style.css',
      },
    },
    rules: {
      // Class order and wrapping are left to prettier-plugin-tailwindcss.
      ...betterTailwindcss.configs.correctness.rules,
      'better-tailwindcss/no-unknown-classes': [
        'error',
        {
          ignore: [
            // Plain CSS classes from our own stylesheets, which Tailwind doesn't register.
            '^(app|shot|library|analyzer|analysis|statistics|action|profile|tooltip)-',
            // daisyUI classes that only exist inside compound selectors.
            '^(dropdown-content|dropdown-open|modal-open|tab-active|indicator-item)$',
          ],
        },
      ],
      'better-tailwindcss/no-duplicate-classes': 'warn',
      'better-tailwindcss/no-deprecated-classes': 'warn',
      'better-tailwindcss/no-unnecessary-whitespace': 'warn',
    },
  },
];
