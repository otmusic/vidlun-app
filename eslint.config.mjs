import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const INWARD_ONLY =
  'Dependencies point inward. Move the concern behind a port interface instead.';
const NO_FRAMEWORK =
  'This layer must stay free of framework, native and I/O dependencies.';
const COMPOSITION_ROOT =
  'Concrete classes are wired in src/di/container.ts and injected from the app root.';

const FRAMEWORK_PACKAGES = [
  'react',
  'react-native',
  'react-native/*',
  'expo',
  'expo-*',
  'whisper.rn',
  '@react-native-async-storage/*',
];

/** Both alias and relative spellings of an import that escapes the current layer. */
function layer(name) {
  return [`@/${name}`, `@/${name}/*`, `**/${name}/*`];
}

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      '.expo/',
      'dist/',
      'coverage/',
      'assets/',
      'babel.config.js',
      'metro.config.js',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript resolves identifiers; the ESLint core rule only produces
      // false positives on type-only and ambient declarations.
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'no-public' },
      ],
      'no-restricted-imports': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['src/domain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: FRAMEWORK_PACKAGES, message: NO_FRAMEWORK },
            {
              group: [
                ...layer('application'),
                ...layer('infrastructure'),
                ...layer('presentation'),
                ...layer('di'),
                ...layer('i18n'),
              ],
              message: INWARD_ONLY,
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/application/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: FRAMEWORK_PACKAGES, message: NO_FRAMEWORK },
            {
              group: [
                ...layer('infrastructure'),
                ...layer('presentation'),
                ...layer('i18n'),
              ],
              message: INWARD_ONLY,
            },
            { group: layer('di'), message: COMPOSITION_ROOT },
          ],
        },
      ],
    },
  },

  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...layer('application'),
                ...layer('presentation'),
                ...layer('i18n'),
              ],
              message: INWARD_ONLY,
            },
            { group: layer('di'), message: COMPOSITION_ROOT },
          ],
        },
      ],
    },
  },

  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: layer('infrastructure'), message: INWARD_ONLY },
            { group: layer('di'), message: COMPOSITION_ROOT },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    // Build scripts report to the terminal; the console is their output device.
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
