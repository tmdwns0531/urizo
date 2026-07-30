import type { CSSProperties } from "react";
import type { CatalogContent } from "@/contracts/catalog";

const posterMotifs = ["✦", "◐", "△", "⌁", "✺", "◇"];

function stringHash(value: string) {
  return [...value].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
}

export function PosterArt({
  content,
  priority = false,
}: {
  content: Pick<
    CatalogContent,
    "id" | "title" | "backdropColor" | "releaseYear"
  >;
  priority?: boolean;
}) {
  const motif = posterMotifs[stringHash(content.id) % posterMotifs.length];

  return (
    <div
      className={`poster-art${priority ? " poster-art--hero" : ""}`}
      style={{ "--poster-tone": content.backdropColor } as CSSProperties}
      role="img"
      aria-label={`${content.title} 데모 포스터`}
    >
      <span className="poster-art__grain" aria-hidden="true" />
      <span className="poster-art__motif" aria-hidden="true">
        {motif}
      </span>
      <span className="poster-art__meta">OTT DAMOA · {content.releaseYear}</span>
      <strong>{content.title}</strong>
    </div>
  );
}
