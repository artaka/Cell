import React, { useState } from 'react';
import { X } from 'lucide-react';

interface MediaWithPreloaderProps {
  url: string;
  type: 'image' | 'video';
  alt?: string;
  onClick?: () => void;
  className?: string;
}

export const MediaWithPreloader: React.FC<MediaWithPreloaderProps> = ({
  url,
  type,
  alt = 'Вложение',
  onClick,
  className = '',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  if (isCancelled) {
    return null;
  }

  const isVideo = type === 'video' || /\.(mp4|webm|mov)$/i.test(url);

  return (
    <div
      className={`media-container-relative max-w-sm cursor-pointer group ${className}`}
      onClick={isLoaded && onClick ? onClick : undefined}
    >
      {/* Blurred / loading overlay until loaded */}
      {!isLoaded && (
        <div className="media-preloader-overlay">
          <div
            className="media-preloader-circle"
            title="Загрузка медиа..."
          >
            {/* Spinning ring animation */}
            <div className="media-preloader-spinner" />
            {/* Cross/Cancel icon as in user reference */}
            <X size={18} className="media-preloader-close-icon" />
          </div>
        </div>
      )}

      {/* Media item with blur while loading */}
      {isVideo ? (
        <video
          src={url}
          controls={isLoaded}
          playsInline
          preload="metadata"
          onLoadedData={() => setIsLoaded(true)}
          className={`w-full max-h-72 rounded-xl object-contain bg-black transition-all ${
            isLoaded ? 'media-loaded' : 'media-blur-loading'
          }`}
        />
      ) : (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          className={`w-full max-h-72 rounded-xl object-cover hover:opacity-95 transition-all ${
            isLoaded ? 'media-loaded' : 'media-blur-loading'
          }`}
        />
      )}
    </div>
  );
};
