
import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

const config = {
  darkMode: "class",
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        /* ============================================
           Evermore Design System Colors
           Based on target design specification
           ============================================ */

        // Primary Background
        "background-cream": "#FCF8F3",

        // Accent Colors (Warm Tones)
        "gold": "#E1B88B",           // Muted Gold/Light Ochre
        "terracotta": "#D68D5B",     // Primary CTA - Terracotta
        "sienna": "#B87333",         // Logo/Rich Accents - Rich Sienna

        // Neutral Tones
        "text-primary": "#5A4F4A",   // Deep Warm Grey/Brown
        "text-secondary": "#8A7F7C", // Medium Warm Grey
        "text-muted": "#CFC7C3",     // Light Warm Grey

        // New Warm Accents for Pivot
        "peach": {
          "light": "#FFF5ED",
          "main": "#FDE2D0",
          "warm": "#FAC9A8",
        },
        "orange-warm": "#E89B66",

        // Functional aliases
        "primary": "#D68D5B",
        "primary-dark": "#B87333",
        "secondary": "#E1B88B",
        "background-light": "#FCF8F3",
        "surface-light": "#FCF8F3",
        "border-light": "#CFC7C3",

        // ShadCN UI Colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        // Primary Font (Headings) - Warm, legible serif
        display: ["Merriweather", "Georgia", "serif"],
        serif: ["Merriweather", "Georgia", "serif"],
        // Secondary Font (Body) - Clean, modern sans-serif
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "1.25rem", // 20px - matches design system
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1.25rem",
        xl: "1.5rem",
        "2xl": "2rem",
        "3xl": "3rem",
        full: "9999px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config

export default config
