/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Professional Black & White Brand Colors
        'brand-black': '#000000',
        'brand-white': '#FFFFFF',
        'brand-dark-gray': '#1A1A1A',
        'brand-medium-gray': '#4A4A4A',
        'brand-light-gray': '#E8E8E8',

        // Light Mode Colors (Black & White)
        light: {
          bg: '#FFFFFF',
          surface: '#F8F8F8',
          'text-primary': '#000000',
          'text-secondary': '#555555',
          border: '#D0D0D0',
          hover: '#F0F0F0',
        },

        // Dark Mode Colors (Black & White)
        dark: {
          bg: '#0F0F0F',
          surface: '#1A1A1A',
          'surface-alt': '#2D2D2D',
          'text-primary': '#FFFFFF',
          'text-default': '#E5E5E5',
          'text-secondary': '#AAAAAA',
          border: '#404040',
          hover: '#2D2D2D',
        },

        // Status Colors (Monochrome compatible)
        success: '#2D5A2D',
        warning: '#5A4A2D',
        error: '#5A2D2D',
        info: '#2D4A5A',
      },
      width: {
        'card': '28rem',
      },
      borderRadius: {
        'card': '1.25rem',
      },
      boxShadow: {
        'card': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'card-dark': '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      },
      fontFamily: {
        'wells': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
