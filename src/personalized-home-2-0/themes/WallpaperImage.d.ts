import type { ImgHTMLAttributes } from "react";

export type WallpaperImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  mimeType?: string;
};

export default function WallpaperImage(props: WallpaperImageProps): JSX.Element | null;
