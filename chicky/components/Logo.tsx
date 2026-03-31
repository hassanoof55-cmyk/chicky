
import React from 'react';

interface LogoProps {
  className?: string;
  src?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "h-10", src }) => {
  const fallback = "https://raw.githubusercontent.com/ai-studio-assets/chicky-logo/main/logo-red.png";
  
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={src || fallback} 
        alt="Chicky Logo"
        fetchPriority="high"
        decoding="async"
        className="h-full w-auto object-contain transition-transform hover:scale-105"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = fallback;
        }}
      />
    </div>
  );
};

export default Logo;
