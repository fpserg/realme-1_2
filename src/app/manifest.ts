import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RealMe",
    short_name: "RealMe",
    description: "A truthful, evolving model of a lived world.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090c14",
    theme_color: "#090c14",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
