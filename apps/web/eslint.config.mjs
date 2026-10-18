import { FlatCompat } from '@eslint/eslintrc';

// Next.js 15 still exports legacy ESLint configs; FlatCompat converts them for ESLint 9.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'] },
];
