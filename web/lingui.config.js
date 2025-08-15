import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "en",
  locales: ["de", "en", "fr", "es"],
  format: "po",
  catalogs: [
    {
      path: "./src/locales/{locale}/messages",
      include: ["src"],
    },
  ],
  formatOptions: {
    lineNumbers: false,
  },
});
