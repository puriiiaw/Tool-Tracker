import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Site Tool Tracker",
    short_name: "Tool Tracker",
    start_url: "/checkout",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#163b6c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
