import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([globalIgnores([".next/**", "dist/**", "node_modules/**"])]);
