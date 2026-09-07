import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.claude/**', 'prisma/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Must come before the custom rules block below, not after — eslint-config-prettier
  // disables `curly` (it treats brace style as Prettier's concern), so if this ran
  // last it would silently turn our own explicit curly rule back off.
  eslintConfigPrettier,
  {
    rules: {
      // Always braced, never single-line — no `if (x) doThing();`.
      curly: ['error', 'all'],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
