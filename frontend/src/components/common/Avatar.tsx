import React from 'react';

interface AvatarProps {
  id?: string;
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

const DOT_SIZES = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
};

// Generates consistent pleasant background gradients based on string
const GRADIENTS = [
  'from-emerald-500 to-teal-700',
  'from-green-500 to-emerald-700',
  'from-teal-500 to-green-700',
  'from-emerald-600 to-green-800',
  'from-lime-600 to-emerald-700',
  'from-teal-600 to-emerald-800',
];

export const Avatar: React.FC<AvatarProps> = ({
  id,
  name,
  imageUrl,
  size = 'md',
  isOnline,
  className = '',
}) => {
  const [hasError, setHasError] = React.useState(false);

  // Reset error state if imageUrl changes
  React.useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  const getInitials = (str: string): string => {
    if (!str) return '?';
    const parts = str.trim().split(/\s+|_/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const getGradient = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % GRADIENTS.length;
    return GRADIENTS[idx];
  };

  const gradient = getGradient(id || name || 'default');
  const showImage = Boolean(imageUrl) && !hasError;

  return (
    <div className={`relative inline-flex flex-shrink-0 items-center justify-center rounded-full select-none ${SIZE_CLASSES[size]} ${className}`}>
      {showImage ? (
        <img
          src={imageUrl!}
          alt={name}
          className="w-full h-full object-cover rounded-full"
          onError={() => {
            // fallback to initials on broken image or 404 from storage
            setHasError(true);
          }}
        />
      ) : (
        <div className={`w-full h-full rounded-full bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-bold tracking-tight shadow-sm`}>
          {getInitials(name)}
        </div>
      )}

      {isOnline !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-[#111b21] ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
          } ${DOT_SIZES[size]}`}
          title={isOnline ? 'В сети' : 'Не в сети'}
        />
      )}
    </div>
  );
};
