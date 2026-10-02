const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const nextPlugin = require("@next/eslint-plugin-next");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = [
	{
		ignores: [
			"eslint.config.js",
			".next/**",
			"node_modules/**",
			"out/**",
			"coverage/**",
			"public/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.{js,mjs,cjs,ts,tsx}"],
		plugins: {
			"@next/next": nextPlugin,
			"react-hooks": reactHooks,
		},
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				console: "readonly",
				fetch: "readonly",
				Headers: "readonly",
				Request: "readonly",
				Response: "readonly",
				URL: "readonly",
				URLSearchParams: "readonly",
				window: "readonly",
				document: "readonly",
				localStorage: "readonly",
				sessionStorage: "readonly",
			},
		},
		rules: {
			"no-var": "error",
			"prefer-const": "error",
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@next/next/no-img-element": "warn",
			"react-hooks/exhaustive-deps": "warn",
		},
	},
];
