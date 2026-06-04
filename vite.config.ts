import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  const appVersion = process.env.VITE_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "__DEV__";

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "inline",
        workbox: {
          globIgnores: ["**/app-version.json"],
        },
        manifest: {
          name: "Hem-Listan",
          short_name: "Hem-Listan",
          theme_color: "#FAF9F5",
          background_color: "#FAF9F5",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
