/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"], // app ships light-only; .dark is never applied
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
                xl: '16px',
                pill: '999px',
            },
            boxShadow: {
                xs: 'var(--shadow-xs)',
                sm: 'var(--shadow-sm)',
                DEFAULT: 'var(--shadow-md)',
                md: 'var(--shadow-md)',
                lg: 'var(--shadow-lg)',
                xl: 'var(--shadow-xl)',
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
                popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
                primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
                secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
                muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
                accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
                destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    1: 'hsl(var(--chart-1))', 2: 'hsl(var(--chart-2))', 3: 'hsl(var(--chart-3))',
                    4: 'hsl(var(--chart-4))', 5: 'hsl(var(--chart-5))',
                },
                // Brand scales
                forest: {
                    50: 'var(--forest-50)', 100: 'var(--forest-100)', 200: 'var(--forest-200)',
                    300: 'var(--forest-300)', 400: 'var(--forest-400)', 500: 'var(--forest-500)',
                    600: 'var(--forest-600)', 700: 'var(--forest-700)', 800: 'var(--forest-800)', 900: 'var(--forest-900)',
                },
                sage: { 50: 'var(--sage-50)', 100: 'var(--sage-100)', 200: 'var(--sage-200)', 300: 'var(--sage-300)', 400: 'var(--sage-400)' },
                lime: { 300: 'var(--lime-300)', 400: 'var(--lime-400)', 500: 'var(--lime-500)' },
                // Status palettes
                success: { DEFAULT: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)' },
                warning: { DEFAULT: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
                danger:  { DEFAULT: 'var(--danger)',  bg: 'var(--danger-bg)',  border: 'var(--danger-border)' },
                info:    { DEFAULT: 'var(--info)',    bg: 'var(--info-bg)',    border: 'var(--info-border)' },
                violet:  { DEFAULT: 'var(--violet)',  bg: 'var(--violet-bg)',  border: 'var(--violet-border)' },
                sidebar: { DEFAULT: 'var(--surface-sidebar)', foreground: 'var(--text-on-dark)', muted: 'var(--text-on-dark-muted)' },
            },
            keyframes: {
                'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
                'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
