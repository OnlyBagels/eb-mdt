import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess({ script: true }),
  compilerOptions: {
    warningFilter: (warning) => !warning.code.includes("a11y"),
  },
};
