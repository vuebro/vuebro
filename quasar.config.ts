import { defineConfig } from "#q-app/wrappers";
import { fileURLToPath } from "url";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(() => ({
  animations: ["zoomIn", "zoomOut"],
  boot: ["main", "route", "quasar-lang-pack", "i18n", "monaco"],
  build: {
    alias: { "node:path": "path-browserify" },
    extendViteConf: () => ({
      base: "./",
      define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      },
      plugins: [
        viteStaticCopy({
          targets: [
            { dest: "runtime", src: "./node_modules/@vuebro/runtime/dist/*" },
          ],
        }),
      ],
    }),
    target: { browser: ["es2022", "firefox115", "chrome115", "safari15"] },
    typescript: { strict: true, vueShim: true },
    vitePlugins: [
      [
        "@intlify/unplugin-vue-i18n/vite",
        { include: [fileURLToPath(new URL("./src/i18n", import.meta.url))] },
      ],
      [
        "vite-plugin-checker",
        {
          eslint: {
            lintCommand:
              'eslint -c ./eslint.config.ts "./src*/**/*.{ts,js,mjs,cjs,vue}"',
            useFlatConfig: true,
          },
          vueTsc: true,
        },
        { server: false },
      ],
      ["@unocss/vite"],
      ["@vue-macros/reactivity-transform/vite"],
    ],
  },
  css: [
    "app.css",
    "~@milkdown/crepe/theme/common/style.css",
    "~@milkdown/crepe/theme/frame.css",
  ],
  devServer: { open: false },
  electron: {
    builder: {
      appId: "vuebro",
      publish: [{ provider: "github", releaseType: "release" }],
      releaseInfo: { releaseNotesFile: "release-notes.md" },
      snap: { publish: [{ channels: ["stable"], provider: "snapStore" }] },
    },
    bundler: "builder",
    preloadScripts: ["electron-preload"],
  },
  extras: ["mdi-v7", "roboto-font", "material-icons"],
  framework: { plugins: ["Dialog", "Notify"] },
}));
