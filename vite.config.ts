import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa'; // 👈 1. Lägg till denna import längst upp

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({ // 👈 2. Lägg till PWA-pluginet här med autoUpdate
        registerType: 'autoUpdate',
        injectRegister: 'inline', // Tvingar mobilen att registrera uppdateringen direkt i HTML-koden
        manifest: {
          name: 'Hem-Listan',
          short_name: 'Hem-Listan',
          theme_color: '#FAF9F5',
          background_color: '#FAF9F5',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDDozSzqxVqljucfmI2KbMHCz31aB8XJTlwjsuQBKIwBi2UfihM3YJWBGGg4gBHOMrD0xTxhodCmn-RbAhvGADooRReTPM47r4jARWz9e7c6nwZH6QNuxFW4f-aBXGLg0y9e_IGdU4Syd5ektDCqyfrmiDEu0kxvP0gsp2s2UPKwjQWLq8FflZqHptEhPXHwx2jQYrGt3FqcSXsBf5ymOWNXA_YlX9FywkT33dDrZoFkP_WsfP91IanCVdherTzzqWspYhavdZgt1c',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
