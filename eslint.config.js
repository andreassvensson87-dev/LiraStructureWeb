import globals from 'globals';
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
    },
  },
  {
    files: [
      'src/main.js',
      'src/app/model-*.js',
      'src/app/workspace-*.js',
      'src/model/ui/**/*.js',
      'src/inspector/model-*.js',
    ],
    rules: { 'no-unused-vars': ['error', { args: 'none' }] },
  },
  {
    files: ['src/main.js'],
    rules: {
      'no-restricted-globals': ['error', 'document', 'window', 'localStorage', 'sessionStorage'],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '^(?!\\./(?:app/(?:workspace-startup|model-application)\\.js|(?:style|cad-statusbar|drawing-editor-header|drawing-view-grips)\\.css)$)',
              message:
                'main.js only loads styles, recovers the workspace and starts the application.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression, IfStatement, SwitchStatement, ForStatement, ForOfStatement, ForInStatement, WhileStatement, AssignmentExpression, NewExpression',
          message: 'Put application behavior in its owning controller; main.js is the entry point.',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: { 'no-undef': 'error' },
  },
  {
    files: [
      'src/project/**/*.js',
      'src/model/object-types/**/*.js',
      'src/model/tools/**/*.js',
      'src/model/navigation.js',
      'src/app/model-editor.js',
    ],
    rules: {
      'no-restricted-globals': ['error', 'document', 'window', 'localStorage', 'sessionStorage'],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/main.js',
                '**/inspector.js',
                '**/ui/**',
                '**/*controller.js',
                '**/*editor.js',
              ],
              message: 'Domain code must not depend on UI or application controllers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/drawing/ui/**/*.js'],
    rules: {
      'no-restricted-globals': ['error', 'localStorage', 'sessionStorage'],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/project/**',
                '**/main.js',
                '**/plan-view.js',
                '**/single-part-sheet.js',
                '**/model-object.js',
              ],
              message: 'Drawing UI builds controls; its controller supplies data and actions.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/app/model-application.js',
      'src/app/model-components.js',
      'src/app/model-fasteners.js',
      'src/app/model-items.js',
      'src/app/workspace-*.js',
      'src/model/ui/**/*.js',
      'src/inspector/**/*.js',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "AssignmentExpression[left.object.name='project'][left.property.name='objects']",
          message: 'Use modelEditor to commit model changes and history.',
        },
        {
          selector:
            "CallExpression[callee.object.object.name='project'][callee.object.property.name='objects'][callee.property.name=/^(push|splice|pop|shift|unshift|sort|reverse)$/]",
          message: 'UI must submit model changes to modelEditor.',
        },
      ],
    },
  },
  {
    files: ['src/app/model-application.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "AssignmentExpression[left.object.name='project'][left.property.name='objects']",
          message: 'Use modelEditor to commit model changes and history.',
        },
        {
          selector:
            "CallExpression[callee.object.object.name='project'][callee.object.property.name='objects'][callee.property.name=/^(push|splice|pop|shift|unshift|sort|reverse)$/]",
          message: 'UI must submit model changes to modelEditor.',
        },
        {
          selector:
            "AssignmentExpression[left.property.name=/^on(click|submit|change|input|keydown|pointerdown|pointermove)$/], CallExpression[callee.property.name='addEventListener']",
          message:
            'Application composition wires controllers; its owning controller handles UI events.',
        },
      ],
    },
  },
];
