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
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

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
    if (banners.length <= 1 || isPaused) return;
    
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length, isPaused, nextSlide]);

  if (!banners || banners.length === 0) return null;

  return (
    <section 
      className="relative w-full px-4 md:px-8 mt-4 md:mt-6 group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/7] md:aspect-[16/6] lg:aspect-[21/7] overflow-hidden bg-slate-100 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl shadow-slate-200/50 border-4 border-white">
        {/* Slider Container */}
        <div 
          className="flex h-full transition-transform duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ 
            transform: `translateX(${isAr ? currentIndex * (100 / banners.length) : -currentIndex * (100 / banners.length)}%)`,
            width: `${banners.length * 100}%`
          }}
        >
          {banners.map((banner, idx) => (
            <div 
              key={banner.id} 
              className={`h-full relative flex-shrink-0 ${banner.targetCategoryId ? 'cursor-pointer' : ''}`}
              style={{ width: `${100 / banners.length}%` }}
              onClick={() => banner.targetCategoryId && onCategoryClick(banner.targetCategoryId)}
            >
              <img 
                src={banner.image} 
                alt={isAr ? banner.titleAr : banner.titleEn}
                className="w-full h-full object-cover object-center select-none"
                loading={idx === 0 ? "eager" : "lazy"}
                fetchPriority={idx === 0 ? "high" : "auto"}
              />
              {/* Subtle Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            </div>
          ))}
        </div>

        {/* Pagination Dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-20">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className={`group relative h-2.5 transition-all duration-300 rounded-full ${
                  currentIndex === idx 
                    ? 'w-10 bg-white shadow-xl scale-110' 
                    : 'w-2.5 bg-white/40 hover:bg-white/70 shadow-sm'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* ProgressBar */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/10 z-30">
          {!isPaused && (
            <div 
              key={currentIndex}
              className="h-full bg-red-600 animate-progress opacity-80"
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;
