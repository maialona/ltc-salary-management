import React from 'react';
import { useTheme } from '../context/ThemeContext';

const AURORA =
  'repeating-linear-gradient(100deg,#3b82f6 10%,#a5b4fc 15%,#93c5fd 20%,#ddd6fe 25%,#60a5fa 30%)';

const DARK_STRIPE =
  'repeating-linear-gradient(100deg,#000 0%,#000 7%,transparent 10%,transparent 12%,#000 16%)';

const LIGHT_STRIPE =
  'repeating-linear-gradient(100deg,#fff 0%,#fff 7%,transparent 10%,transparent 12%,#fff 16%)';

const RADIAL_MASK =
  'radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)';

export function AuroraBackground({ children, showRadialGradient = true }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const stripe = isLight ? LIGHT_STRIPE : DARK_STRIPE;
  const mask = showRadialGradient ? RADIAL_MASK : undefined;

  return (
    <div
      className="relative flex flex-col min-h-screen items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Aurora overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          style={{
            position: 'absolute',
            inset: '-10px',
            backgroundImage: `${stripe}, ${AURORA}`,
            backgroundSize: '300%, 200%',
            backgroundPosition: '50% 50%, 50% 50%',
            filter: isLight ? 'blur(10px) invert(1)' : 'blur(10px)',
            opacity: 0.5,
            willChange: 'transform',
            pointerEvents: 'none',
            maskImage: mask,
            WebkitMaskImage: mask,
          }}
        >
          {/* Animated mix-blend difference layer (replaces ::after) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `${stripe}, ${AURORA}`,
              backgroundSize: '200%, 100%',
              backgroundAttachment: 'fixed',
              mixBlendMode: 'difference',
              animation: 'aurora 60s linear infinite',
            }}
          />
        </div>
      </div>

      {children}
    </div>
  );
}
