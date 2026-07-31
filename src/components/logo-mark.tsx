import Image from "next/image";

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/brand/icon-192.png"
      alt="Manthan Vidyashram"
      width={size}
      height={size}
      className="rounded-full shadow-sm"
      priority
    />
  );
}
