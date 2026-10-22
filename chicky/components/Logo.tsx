
import React from 'react';

interface LogoProps {
  className?: string;
  src?: string;
  variant?: 'red' | 'white';
}

const Logo: React.FC<LogoProps> = ({ className = "h-10", src, variant = 'red' }) => {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const fallback = `/brand/chicky-${variant}.png`;
  const imageSrc = src && src !== failedSrc ? src : fallback;
  
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={imageSrc}
        alt="CHICKY"
        fetchPriority="high"
        decoding="async"
        className="h-full w-auto object-contain transition-transform hover:scale-105"
        onError={(e) => {
          if (imageSrc !== fallback) setFailedSrc(imageSrc);
        }}
      />
    </div>
  );
};

export default Logo;
