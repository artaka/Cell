import React from 'react';
import { useUI } from '../../context/UIContext';
import { X, Download, ZoomIn } from 'lucide-react';

export const LightboxModal: React.FC = () => {
  const { lightboxImageUrl, closeLightbox } = useUI();

  if (!lightboxImageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = lightboxImageUrl;
    a.download = `cell_image_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="lightbox-backdrop" onClick={closeLightbox}>
      {/* Top action toolbar */}
      <div
        className="fixed top-4 right-4 flex items-center gap-2 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleDownload}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition"
          title="Скачать изображение"
        >
          <Download size={20} />
        </button>

        <button
          onClick={closeLightbox}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition"
          title="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      {/* Image viewer */}
      <div onClick={(e) => e.stopPropagation()} className="relative flex items-center justify-center">
        <img
          src={lightboxImageUrl}
          alt="Просмотр"
          className="lightbox-image"
        />
      </div>
    </div>
  );
};
