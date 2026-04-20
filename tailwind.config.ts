import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx,mdx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f5f0',
          100: '#efe9dd',
          200: '#d9cdb4',
          300: '#b59e76',
          400: '#8a7251',
          500: '#5e4b33',
          600: '#453722',
          700: '#2f2515',
          800: '#1d160c',
          900: '#110c06'
        },
        blood: {
          400: '#b83c3c',
          500: '#8a2626',
          600: '#5d1616',
          700: '#3a0909'
        },
        ember: {
          400: '#e79a3c',
          500: '#c07422',
          600: '#8a4d12'
        }
      },
      fontFamily: {
        serif: ['"EB Garamond"', '"Iowan Old Style"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace']
      }
    }
  },
  plugins: []
};

export default config;
