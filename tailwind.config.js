/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.3s ease-in',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
        'float-down': 'floatDown 1.2s ease-in forwards',
        'flash': 'flash 0.6s ease-in-out 2',
        'arrow-bounce': 'arrowBounce 1.2s ease-in-out infinite',
        'shake': 'shake 0.4s ease-in-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeOut: { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
        popIn: { '0%': { transform: 'scale(0.85)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(251, 191, 36, 0.5)' },
          '50%': { boxShadow: '0 0 24px rgba(251, 191, 36, 0.9)' },
        },
        floatDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '1' },
          '100%': { transform: 'translateY(60px)', opacity: '0' },
        },
        flash: {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.8) saturate(1.5)' },
        },
        arrowBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(8px)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
    },
  },
  plugins: [],
}