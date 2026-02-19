import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        safegram: {
          bg: '#0a0e1a',
          surface: '#1a1f35',
          glass: 'rgba(255,255,255,0.05)',
          accent: '#7c6cff',
          accent2: '#3dd8ff',
          border: 'rgba(255,255,255,0.1)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-safegram': 'linear-gradient(135deg, #7c6cff 0%, #3dd8ff 100%)',
      },
      backdropBlur: {
        glass: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
