import React from 'react';

interface LogoProps {
  className?: string;
}

/**
 * Logo Component
 * This component now uses a local file path.
 * Make sure to upload "logo with.png" to the /public folder.
 */
export const Logo: React.FC<LogoProps> = ({ className = "h-12 w-auto" }) => {
  return (
    <img 
      src="/logo with.png" 
      alt="HIIVE Logo" 
      className={`object-contain ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};

export default Logo;
