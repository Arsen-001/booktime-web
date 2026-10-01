import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const NO_RAW_TRANSLATIONS = {
  name: 'next-intl',
  importNames: ['useTranslations'],
  message: 'Тексты — через useT(ns) из @/i18n/useT: он сообщает в консоль о непереведённых ключах (см. CONVENTIONS.md).',
};

const NO_DIRECT_DB = [
  { name: '@/mock/db', message: 'Данные — только через src/api/* (useApiQuery / useApiMutation), см. CONVENTIONS.md.' },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'qa/**', 'test-results/**', 'playwright-report/**']),
  {
    // Имя с «_» — намеренно неиспользуемое (просьба ядра k2–k4)
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/i18n/**', 'src/demo/hooks.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [NO_RAW_TRANSLATIONS] }],
    },
  },
  {
    // Разделы и страницы: без прямого доступа к моковой базе
    // src/api/<area>/** — папка раздела (arch-a1 №10): те же правила, что у src/api/<area>.ts
    files: ['src/areas/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}', 'src/api/**/*.ts'],
    // *.server.ts и mirror.ts — мост режима api в ядро браузера (PLAN.md §7): кладут ответ сервера в мок,
    // чтобы разделы, ещё не переехавшие на сервер, видели те же данные; это и есть их работа
    ignores: ['src/api/core.ts', 'src/api/area.ts', 'src/api/request.ts', 'src/api/mirror.ts', 'src/api/**/*.server.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [NO_RAW_TRANSLATIONS, ...NO_DIRECT_DB], patterns: [{ group: ['@/mock/slices/*'], message: 'Свой срез читайте через readArea/mutateArea в src/api/<area>.ts.' }] },
      ],
    },
  },
  {
    // Типы и правила (src/domain/**) — чистые: без React, стора, api и экранов, переносятся на сервер как есть
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            NO_RAW_TRANSLATIONS,
            ...NO_DIRECT_DB,
            { name: 'react', message: 'src/domain — чистые функции без React (docs/ARCHITECTURE.md §2).' },
          ],
          patterns: [
            {
              group: ['@/api/*', '@/mock/*', '@/ui/*', '@/areas/*', '@/shell/*', '@/demo/hooks', '@/demo/store', '@/demo/DemoProvider'],
              message: 'src/domain — чистые функции: без api, стора, UI и экранов (docs/ARCHITECTURE.md §2).',
            },
          ],
        },
      ],
    },
  },
  {
    // 25.09.2026, пользователь: «все модалки и алерты должны быть наши, а не нативные».
    // Системные диалоги и системные элементы ввода запрещены вне src/ui (там — наши замены).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/ui/**', 'src/dev/**', 'src/app/dev/**'],
    rules: {
      'no-alert': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: "JSXOpeningElement[name.name='select']", message: 'Только Select/Combobox из @/ui — системный <select> запрещён.' },
        { selector: "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value=/^(date|time|datetime-local|month|week|color)$/]", message: 'Только DatePicker/TimePicker/ColorPicker из @/ui — системные пикеры запрещены.' },
        { selector: "JSXOpeningElement[name.name='dialog']", message: 'Только Modal/Sheet/ConfirmDialog из @/ui.' },
        { selector: "JSXAttribute[name.name='title'][value.type='Literal']", message: 'Подсказки — Tooltip из @/ui, не системный title.' },
        { selector: "CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt|print)$/]", message: 'Только наши Toast/ConfirmDialog из @/ui.' },
      ],
    },
  },
]);

export default eslintConfig;
