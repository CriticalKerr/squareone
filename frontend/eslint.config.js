// - Checks JavaScript code for mistakes and keeps it clean

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

//______________________________________________________
// ESLINT CONFIGURATION
// This file tells ESLint how to check our JavaScript and React code for:
// - Syntax errors and bugs
// - Code style consistency
// - React-specific best practices
// - Unused variables and imports
//______________________________________________________

//______________________________________________________
// ESLINT CONFIG SETUP
// Tell ESLint what rules and settings to use for JS and JSX files
export default defineConfig([

  //______________________________________________________
  // GLOBAL IGNORE
  // Skip linting the dist folder
  globalIgnores(['dist']),

  //______________________________________________________
  // RULES FOR JS/JSX FILES
  // Apply these settings to all .js and .jsx files
  {
    files: ['**/*.{js,jsx}'],

    //______________________________________________________
    // EXTENDING RULE SETS
    // Use recommended rules from ESLint, React Hooks, and React Refresh
    extends: [
      js.configs.recommended, // Core ESLint recommended rules
      reactHooks.configs['recommended-latest'], // React Hooks lint rules
      reactRefresh.configs.vite, // Vite-specific React Fast Refresh rules
    ],

    //______________________________________________________
    // LANGUAGE OPTIONS
    // Tell ESLint about JavaScript version and globals
    languageOptions: {
      ecmaVersion: 2020,              // Use ES2020 syntax
      globals: globals.browser,       // Browser global variables
      parserOptions: {
        ecmaVersion: 'latest',        // Allow the latest JS features
        ecmaFeatures: { jsx: true },  // Enable JSX parsing
        sourceType: 'module',         // Use ES modules (import/export)
      },
    },

    //______________________________________________________
    // CUSTOM RULES
    // Warn or error on unused variables, except ones starting with uppercase or underscore
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
