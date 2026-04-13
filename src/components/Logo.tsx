import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'withText';
}

/**
 * Logo Component
 * This component now uses a local file path.
 * Make sure to upload "logo.png" and "logo with.png" to the /public folder.
 */
export const Logo: React.FC<LogoProps> = ({ className = "h-12 w-auto", variant = 'default' }) => {
  const src = variant === 'withText' ? '/logo-with.png' : '/logo.png';
  
  return (
    <img 
      src={src} 
      alt="HIIVE Logo" 
      className={`object-contain relative z-[100] ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};

export default Logo;
