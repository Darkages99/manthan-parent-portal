import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Manthan Vidyashram Parent Portal",
    short_name: "Manthan Portal",
    description:
      "Attendance, leave, stay-back consent, fees, PTM bookings, results and school messages for Manthan Vidyashram parents.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f9f7f3",
    theme_color: "#540009",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/brand/icon-384.png", sizes: "384x384", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
