/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          deep: '#020f26',
          DEFAULT: '#031c40',
          mid: '#0a2c5c',
        },
        green: {
          DEFAULT: '#8bc64e',
          dark: '#6ea83c',
          tint: '#eef7e3',
        },
        orange: {
          DEFAULT: '#ff6600',
          mid: '#e89149',
          tint: '#fff1e6',
          dark: '#cc4f00',
        },
        neutral: {
          bg: '#f5f6f9',
          border: '#e2e5eb',
          'border-soft': '#edeff3',
          text: '#101a2e',
          secondary: '#5a637a',
          muted: '#8a92a6',
        },
        blue: {
          tint: '#eaf1fb',
          DEFAULT: '#2f5fa8',
        },
        teal: {
          tint: '#e8f5f2',
          DEFAULT: '#1f8a72',
        },
        red: {
          tint: '#fdebe9',
          DEFAULT: '#c23b2f',
        },
      },
      fontFamily: {
        display: ['Newsreader', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '18px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(3,28,64,0.07)',
        md: '0 8px 24px rgba(3,28,64,0.09)',
      },
    },
  },
  plugins: [],
};
