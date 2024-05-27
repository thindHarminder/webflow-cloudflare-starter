import { defineConfig } from "vite";

// vite.config.js
export default defineConfig({

    build: {
        outDir: 'dist', // Folder where the project is built
        rollupOptions: {
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'client/pages/[name].js',
                assetFileNames: '[name].[ext]',
            },
        }
    }
});
