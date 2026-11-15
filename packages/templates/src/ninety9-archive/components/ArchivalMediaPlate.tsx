import React, { useEffect, useState } from "react";
import type { ArchivalPhotoRecord } from "../content/photos.js";

export interface ArchivalMediaPlateProps {
  readonly photo?: ArchivalPhotoRecord;
  readonly fallbackSrc: string;
  readonly fallbackAlt: string;
  readonly fallbackCaption?: string;
  readonly aspectClassName?: string;
  readonly priority?: "hero" | "standard" | "deferred";
  readonly showCredit?: boolean;
  readonly compact?: boolean;
}

/**
 * Monochrome archival media renderer pairing authentic open-source 1990s
 * photographs with high-contrast silver-gelatin CSS filtering and automatic
 * fallback to deterministic vector schematics.
 */
export const ArchivalMediaPlate: React.FC<ArchivalMediaPlateProps> = ({
  photo,
  fallbackSrc,
  fallbackAlt,
  fallbackCaption,
  aspectClassName = "h-48",
  priority = "standard",
  showCredit = true,
  compact = false,
}) => {
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [photo?.src, fallbackSrc]);

  const showingPhoto = Boolean(photo && !useFallback);
  const src = showingPhoto && photo ? photo.src : fallbackSrc;
  const alt = showingPhoto && photo ? photo.alt : fallbackAlt;
  const width = showingPhoto && photo ? photo.width : 480;
  const height = showingPhoto && photo ? photo.height : 320;

  const imgPriorityProps: React.ImgHTMLAttributes<HTMLImageElement> =
    priority === "hero"
      ? { fetchPriority: "high" }
      : priority === "deferred"
        ? { loading: "lazy", fetchPriority: "low", decoding: "async" }
        : { loading: "lazy", decoding: "async" };

  return (
    <figure className="border border-[#000000] bg-[#FFFFFF] p-1.5">
      <div className="n99-halftone-light border border-[#000000] overflow-hidden">
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          onError={() => setUseFallback(true)}
          {...imgPriorityProps}
          className={`${aspectClassName} w-full ${
            showingPhoto ? "n99-archival-photo object-cover" : "n99-dither-img object-contain bg-[#FFFFFF]"
          }`}
        />
      </div>

      {showCredit && (
        <figcaption
          className={`mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-t border-[#808080] pt-1 font-mono uppercase text-[#292929] ${
            compact ? "text-[9px]" : "text-[10px] font-bold"
          }`}
        >
          {showingPhoto && photo ? (
            <>
              <span className="truncate max-w-[70%]">
                <cite className="not-italic font-bold text-[#000000]">{photo.subject}</cite>
                {!compact ? ` — ${photo.artist}` : ""}
              </span>
              <span className="shrink-0 border border-[#000000] bg-[#D9D9D9] px-1 py-0 text-[#000000]">
                {photo.license}
              </span>
            </>
          ) : (
            <span className="truncate">{fallbackCaption ?? fallbackAlt}</span>
          )}
        </figcaption>
      )}
    </figure>
  );
};
