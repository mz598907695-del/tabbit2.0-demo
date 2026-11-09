import type { HTMLAttributes } from 'react';

export type WallpaperMediaProps = HTMLAttributes<HTMLImageElement | HTMLVideoElement> & {
  src: string;
  mimeType?: string;
  posterUrl?: string;
  preview?: boolean;
  alt?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'sync' | 'auto';
};

export default function WallpaperMedia(props: WallpaperMediaProps): JSX.Element | null;
