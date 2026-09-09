import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-space-grotesk)",
          "Space Grotesk",
          "PingFang SC",
          "Noto Sans SC",
          "sans-serif",
        ],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "monospace"],
      },
      colors: {
        music: {
          accent: "var(--music-accent)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
