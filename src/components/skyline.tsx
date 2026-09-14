// Line-art crane and building skyline. Decorative only.
export function Skyline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {/* ground */}
      <path d="M0 132h520" />
      {/* buildings */}
      <path d="M20 132V70h50v62M35 80h8M50 80h8M35 95h8M50 95h8M35 110h8M50 110h8" />
      <path d="M90 132V48h40v84M100 60h7M115 60h7M100 76h7M115 76h7M100 92h7M115 92h7M100 108h7M115 108h7" />
      <path d="M150 132V92h60v40M160 102h10M180 102h10M160 116h10M180 116h10" />
      <path d="M380 132V60h44v72M390 72h8M406 72h8M390 88h8M406 88h8M390 104h8M406 104h8M390 120h8M406 120h8" />
      <path d="M440 132V84h60v48M450 96h10M470 96h10M450 112h10M470 112h10" />
      {/* under construction frame */}
      <path d="M230 132V56h70v76M230 76h70M230 96h70M230 116h70M245 56v76M265 56v76M285 56v76" />
      {/* tower crane */}
      <path d="M330 132V22M324 132V22M324 22h6M318 22h140M318 30h140M318 22l6 8M330 22l6 8M342 22l6 8M354 22l6 8M366 22l6 8M378 22l6 8M390 22l6 8M402 22l6 8M414 22l6 8M426 22l6 8M438 22l6 8M450 22l6 8" />
      <path d="M327 22 300 30M327 30 300 30M300 26v8M327 14l40 8M327 14v8M327 14 300 30" />
      <path d="M400 30v40M395 70h10v8h-10z" />
      <path d="M324 40l6 8M324 56l6 8M324 72l6 8M324 88l6 8M324 104l6 8M324 120l6 8M330 40l-6 8M330 56l-6 8M330 72l-6 8M330 88l-6 8M330 104l-6 8M330 120l-6 8" />
    </svg>
  );
}
