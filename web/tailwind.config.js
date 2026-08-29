/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#140720',
        panel: '#1f0f35',
        'panel-hi': '#2c1650',
        line: '#3a2260',
        p1: '#ff3daf',
        p2: '#31e7f5',
        live: '#b9ff3c',
        wait: '#ffc24b',
        ink: '#f4e9ff',
        'ink-dim': '#9c86c4',
        danger: '#ff5c6c',
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
        body: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-p1': '0 0 0 1px #ff3daf, 0 0 24px -2px #ff3daf88',
        'glow-p2': '0 0 0 1px #31e7f5, 0 0 24px -2px #31e7f588',
        'glow-wait': '0 0 0 1px #ffc24b, 0 0 24px -2px #ffc24b88',
      },
    },
  },
  plugins: [],
}
