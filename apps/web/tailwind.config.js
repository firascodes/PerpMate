/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#97FCE4",
      },
      animation: {
        shine: "shine 8s ease-in-out infinite",
      },
      keyframes: {
        shine: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function ({ addUtilities }) {
      addUtilities({
        ".focus-ring": {
          "@apply focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand":
            {},
        },
      });
    },
  ],
};
export default config;
