import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

const apiFiles = ['apps/api/src/**/*.ts'];
const clientFiles = [
  'apps/mobile/src/**/*.{ts,tsx}',
  'apps/desktop/src/**/*.{ts,tsx}',
];

const architecturalFiles = [...apiFiles, ...clientFiles];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: architecturalFiles,
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            'apps/api/tsconfig.json',
            'apps/desktop/tsconfig.json',
            'apps/mobile/tsconfig.json',
            'packages/*/tsconfig.json',
          ],
        },
      },
      'boundaries/elements': [
        { type: 'api-interface', pattern: 'apps/api/src/interface', mode: 'folder' },
        { type: 'api-application', pattern: 'apps/api/src/application', mode: 'folder' },
        { type: 'api-domain', pattern: 'apps/api/src/domain', mode: 'folder' },
        { type: 'api-infrastructure', pattern: 'apps/api/src/infrastructure', mode: 'folder' },
        { type: 'app', pattern: 'apps/*/src/app', mode: 'folder' },
        { type: 'pages', pattern: 'apps/*/src/pages', mode: 'folder' },
        { type: 'widgets', pattern: 'apps/*/src/widgets', mode: 'folder' },
        { type: 'features', pattern: 'apps/*/src/features', mode: 'folder' },
        { type: 'entities', pattern: 'apps/*/src/entities', mode: 'folder' },
        { type: 'shared', pattern: 'apps/*/src/shared', mode: 'folder' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'api-interface', allow: ['api-interface', 'api-application'] },
            { from: 'api-application', allow: ['api-application', 'api-domain'] },
            { from: 'api-domain', allow: ['api-domain'] },
            { from: 'api-infrastructure', allow: ['api-infrastructure', 'api-domain'] },
            { from: 'app', allow: ['app', 'pages', 'widgets', 'features', 'entities', 'shared'] },
            { from: 'pages', allow: ['pages', 'widgets', 'features', 'entities', 'shared'] },
            { from: 'widgets', allow: ['widgets', 'features', 'entities', 'shared'] },
            { from: 'features', allow: ['features', 'entities', 'shared'] },
            { from: 'entities', allow: ['entities', 'shared'] },
            { from: 'shared', allow: ['shared'] },
          ],
        },
      ],
    },
  },
);
