import { defineConfig } from "#q-app/wrappers";
import { fileURLToPath } from "url";
import { mergeConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(() => ({
  animations: ["zoomIn", "zoomOut"],
  boot: ["main", "route", "quasar-lang-pack", "i18n", "monaco"],
  build: {
    alias: { "node:path": "path-browserify" },
    /**
     * Extends the Vite configuration
     *
     * @param {import("vite").UserConfig} config - The Vite configuration object
     *   to extend
     */
    extendViteConf: (config) => {
      config.base = "./";
      config.define = mergeConfig(
        config.define ?? {},
        {
          __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
        },
        false,
      );
    },
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
      [
        // @ts-expect-error Plugin<any>[]
        viteStaticCopy,
        {
          targets: [
            { dest: "runtime", src: "./node_modules/@vuebro/runtime/dist/*" },
          ],
        },
      ],
    ],
  },
  css: ["app.css"],
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
