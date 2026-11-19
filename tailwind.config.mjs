import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sora: ["Sora", "Inter", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      colors: {
        // Semantic scale.
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        "nav-button": "hsl(var(--nav-button))",
        "hero-bg": "hsl(var(--hero-bg))",

        // Aliases kept so existing sections stay on theme.
        app: {
          bg: "hsl(var(--color-bg))",
          surface: "hsl(var(--color-surface))",
          card: "hsl(var(--color-card))",
          text: "hsl(var(--color-text))",
          muted: "hsl(var(--color-muted))",
          border: "hsl(var(--color-border))",
          primary: "hsl(var(--color-primary))",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
      },
      maxWidth: {
        container: "var(--container-max)",
      },
      spacing: {
        header: "var(--header-h)",
      },
      fontSize: {
        label: "var(--text-label)",
        body: "var(--text-body)",
        h3: "var(--text-h3)",
        h2: "var(--text-h2)",
        h1: "var(--text-h1)",
        display: "var(--text-display)",
      },
      keyframes: {
        "fade-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)",
            filter: "blur(2px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
            filter: "blur(0)",
          },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
      },
    },
  },
  plugins: [animate],
};
