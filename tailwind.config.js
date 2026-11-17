/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Archivo', 'system-ui', 'sans-serif'] },
      colors: {
        marinho: { DEFAULT: '#041435', 700: '#0b2350', 500: '#2a4a86' },
        fundo: '#f5f6f8',
        linha: '#dfe3ea',
        ok: '#1f7a4d', parcial: '#b7791f', falta: '#b42318',
      },
    },
  },
  plugins: [],
};
