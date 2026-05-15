type LogoProps = {
  /** Display size in CSS pixels (square box). */
  size?: number;
  className?: string;
};

const BRAND_SRC = "/assets/grom-brand-mark.png";

/** Official GROM raster mark (886×886, sRGB) from `public/assets/`. */
export default function Logo({ size = 48, className }: LogoProps) {
  return (
    <img
      className={className}
      src={BRAND_SRC}
      width={618}
      height={656}
      alt="GROM"
      decoding="async"
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}
