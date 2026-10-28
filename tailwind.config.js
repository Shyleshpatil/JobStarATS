/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        // Executive deep-slate / blue palette
        base: {
          900: '#0b1220',
          800: '#0f172a',
          700: '#1e293b',
          600: '#334155'
        },
        accent: {
          DEFAULT: '#3b82f6',
          soft: '#60a5fa',
          deep: '#1d4ed8'
        }
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(2, 6, 23, 0.7)',
        glow: '0 0 0 1px rgba(59,130,246,0.25), 0 12px 40px -12px rgba(59,130,246,0.45)'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both'
      }
    }
  },
  plugins: []
}
