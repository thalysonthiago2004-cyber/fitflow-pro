import type { MetadataRoute } from "next";

// Installable app ("Adicionar à tela inicial"). Push notifications on iPhone
// only work once the app is installed this way (iOS 16.4+).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitFlow Pro",
    short_name: "FitFlow",
    description: "Treinos, hidratação, nutrição e evolução com seu personal.",
    lang: "pt-BR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0d0b",
    theme_color: "#0a0d0b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
