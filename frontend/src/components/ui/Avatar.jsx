import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import apiClient from '../../api/client';
import { Loader2 } from 'lucide-react';


const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  xxl: 'w-32 h-32 text-lg'
};
const indicatorSizes = {
  sm: 'w-2.5 h-2.5 -right-0.5 -bottom-0.5',
  md: 'w-3 h-3 -right-0.5 -bottom-0.5',
  lg: 'w-3.5 h-3.5 -right-0.5 -bottom-0.5',
  xl: 'w-4 h-4 right-0 bottom-0',
  xxl: 'w-4 h-4 right-0 bottom-0'
};
const colors = ['from-pink-500 to-rose-500', 'from-purple-500 to-indigo-500', 'from-blue-500 to-cyan-500', 'from-green-500 to-emerald-500', 'from-yellow-500 to-orange-500', 'from-red-500 to-pink-500', 'from-indigo-500 to-purple-500', 'from-teal-500 to-green-500'];


function getColorFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  const parts = name.split(/[\s_-]+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}


export function Avatar({
  name,
  src,
  size = 'md',
  isOnline
}) {
  const [imageSrc, setImageSrc] = useState(
    src?.startsWith('blob:') ? src : null
  );
  const [isLoading, setIsLoading] = useState(Boolean(src && !src.startsWith('blob:')));
  const loadedObjectUrlRef = useRef(null);
  const initials = getInitials(name);
  const colorClass = getColorFromName(name);

  useEffect(() => {
    let active = true;

    if (!src || src.startsWith('blob:')) {
      if (loadedObjectUrlRef.current) {
        URL.revokeObjectURL(loadedObjectUrlRef.current);
        loadedObjectUrlRef.current = null;
      }
      setImageSrc(src || null);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    apiClient
      .get(src, {
        responseType: 'blob',
        // Avatar URLs are versioned, but revalidation also protects older
        // clients that still have the pre-versioned endpoint cached.
        headers: { 'Cache-Control': 'no-cache' }
      })
      .then(({ data }) => {
        if (!active) return;
        const objectUrl = URL.createObjectURL(data);
        if (loadedObjectUrlRef.current) {
          URL.revokeObjectURL(loadedObjectUrlRef.current);
        }
        loadedObjectUrlRef.current = objectUrl;
        setImageSrc(objectUrl);
        setIsLoading(false);
      })
      .catch(() => {
        if (active) {
          setImageSrc(null);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [src]);

  useEffect(() => () => {
    if (loadedObjectUrlRef.current) {
      URL.revokeObjectURL(loadedObjectUrlRef.current);
    }
  }, []);

  return (
    <div className="relative inline-block flex-shrink-0">
      {imageSrc ? <img src={imageSrc} alt={name} loading="lazy" decoding="async" className={clsx('rounded-full object-cover', sizes[size])} onError={() => { setImageSrc(null); setIsLoading(false); }} /> : <div className={clsx('avatar bg-gradient-to-br', colorClass, sizes[size])}>
        {initials}
      </div>}

      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/25" role="status" aria-label="Loading avatar">
          <Loader2 className={clsx('animate-spin text-white', size === 'sm' ? 'h-3 w-3' : 'h-5 w-5')} />
        </span>
      )}

      {/* Online indicator */}
      {isOnline !== undefined && <span className={clsx('absolute rounded-full border-2 border-gray-800', isOnline ? 'bg-green-500' : 'bg-gray-500', indicatorSizes[size])} />}
    </div>
  );
}
