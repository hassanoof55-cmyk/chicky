import React, { useState, useEffect, useCallback } from 'react';
import { HeroBanner } from '../types';

interface HeroCarouselProps {
  banners: HeroBanner[];
  isAr: boolean;
  onCategoryClick: (id: string) => void;
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ banners, isAr, onCategoryClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % (banners?.length || 1));
  }, [banners?.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + (banners?.length || 1)) % (banners?.length || 1));
  }, [banners?.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // In RTL, swiping right (finger moving right) goes to the next slide (which is to the left)
    // In LTR, swiping left (finger moving left) goes to the next slide (which is to the right)
    if (isAr) {
      if (isRightSwipe) nextSlide();
      if (isLeftSwipe) prevSlide();
    } else {
      if (isLeftSwipe) nextSlide();
      if (isRightSwipe) prevSlide();
    }
  };

  useEffect(() => {
    if (!banners || banners.length <= 1 || isPaused) return;
    
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(interval);
  }, [banners?.length, isPaused, nextSlide]);

  if (!banners || banners.length === 0) return null;

  return (
    <section 
      className="relative w-full max-w-7xl mx-auto px-3 md:px-8 mt-4 md:mt-8 group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative w-full aspect-[16/8] sm:aspect-[16/7] md:aspect-[16/6] lg:aspect-[21/7] overflow-hidden bg-white rounded-[2rem] md:rounded-[3.5rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)] border-2 border-white/20">
        {/* Slider Container */}
        <div 
          className="flex h-full transition-transform duration-[1200ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ 
            transform: `translateX(${isAr ? currentIndex * (100 / (banners?.length || 1)) : -currentIndex * (100 / (banners?.length || 1))}%)`,
            width: `${(banners?.length || 1) * 100}%`
          }}
        >
          {banners?.map((banner, idx) => (
            <div 
              key={banner.id} 
              className={`h-full relative flex-shrink-0 overflow-hidden ${banner.targetCategoryId ? 'cursor-pointer' : ''}`}
              style={{ width: `${100 / (banners?.length || 1)}%` }}
              onClick={() => banner.targetCategoryId && onCategoryClick(banner.targetCategoryId)}
            >
              <img 
                src={banner.image} 
                alt={isAr ? banner.titleAr : banner.titleEn}
                className="w-full h-full object-cover object-center select-none"
                loading={idx === 0 ? "eager" : "lazy"}
                fetchPriority={idx === 0 ? "high" : "auto"}
              />
              {/* Refined Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
              <div className="absolute inset-0 bg-red-900/5 mix-blend-overlay pointer-events-none" />
            </div>
          ))}
        </div>

        {/* Pagination Dots */}
        {(banners?.length || 0) > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            {banners?.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className={`group relative h-1.5 transition-all duration-500 rounded-full ${
                  currentIndex === idx 
                    ? 'w-8 bg-white shadow-2xl' 
                    : 'w-1.5 bg-white/30 hover:bg-white/60 hover:w-4'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* ProgressBar */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-black/10 z-30 overflow-hidden">
          {!isPaused && (
            <div 
              key={currentIndex}
              className="h-full bg-red-600 animate-progress origin-left"
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;
