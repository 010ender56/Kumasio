import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "./src",
  base: "/Kumasio/",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, "src/index.html"),
        editor: resolve(import.meta.dirname, "src/editor.html"),
        quiz: resolve(import.meta.dirname, "src/quiz.html"),
        import: resolve(import.meta.dirname, "src/import.html"),
        settings: resolve(import.meta.dirname, "src/settings.html"),
        flashcards: resolve(import.meta.dirname, "src/flashcards.html"),
        practiceSelector: resolve(import.meta.dirname, "src/practice-selector.html"),
      },
    },
  },
});
