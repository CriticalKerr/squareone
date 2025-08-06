import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

//______________________________________________________
// EMULATE __dirname
// Turn the module URL into a file path and get its folder name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//______________________________________________________
// COMPATIBILITY SHIM
// Make ESLint work with older configs (like Next.js defaults)
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

//______________________________________________________
// ESLINT CONFIG
// Extend the recommended Next.js lint rules for best code practices
const eslintConfig = [...compat.extends("next/core-web-vitals")];

//______________________________________________________
// EXPORT CONFIG
// Give this config back to ESLint when it runs
export default eslintConfig;
