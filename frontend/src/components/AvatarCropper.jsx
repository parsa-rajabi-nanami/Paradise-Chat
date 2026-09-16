import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

function createCroppedFile(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const context = canvas.getContext('2d');
      context.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error('Unable to crop this image.'));
            return;
          }
          resolve(new File([blob], 'avatar.webp', { type: 'image/webp' }));
        },
        'image/webp',
        0.92
      );
    };
    image.onerror = () => reject(new Error('Unable to read this image.'));
    image.src = imageSrc;
  });
}

export function AvatarCropper({ imageSrc, onCancel, onComplete }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleUsePhoto = async () => {
    if (!croppedAreaPixels) return;
    setIsSaving(true);
    try {
      const file = await createCroppedFile(imageSrc, croppedAreaPixels);
      await onComplete(file);
    } catch (error) {
      toast.error(error.message || 'Unable to prepare this image.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Crop avatar">
      <div className="w-full max-w-lg rounded-xl bg-[var(--color-surface)] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">Crop avatar</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Drag to reposition and use the slider to zoom.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]" aria-label="Cancel crop">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-80 overflow-hidden rounded-lg bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <label className="mt-4 block text-sm text-[var(--color-text-muted)]" htmlFor="avatar-zoom">
          Zoom
          <input id="avatar-zoom" className="mt-2 w-full accent-[var(--color-primary)]" type="range" min="1" max="3" step="0.1" value={zoom} onChange={event => setZoom(Number(event.target.value))} />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={isSaving} className="btn btn-outline">Cancel</button>
          <button type="button" onClick={handleUsePhoto} disabled={isSaving} className="btn btn-submit flex items-center gap-2">
            <Check className="h-4 w-4" />
            {isSaving ? 'Preparing...' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
