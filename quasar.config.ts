import { defineConfig } from "#q-app/wrappers";
import { fileURLToPath } from "url";
import { viteStaticCopy } from "vite-plugin-static-copy";

/* -------------------------------------------------------------------------- */

const alias = { "node:path": "path-browserify" },
  appId = "vuebro",
  base = "./",
  boot = ["main", "route", "quasar-lang-pack", "i18n", "monaco"],
  browser = ["es2022", "firefox115", "chrome115", "safari15"],
  bundler = "builder",
  channels = ["stable"],
  css = [
    "~@fontsource/space-mono",
    "~@fontsource/noto-sans",
    "~@fontsource/noto-serif",
    "app.scss",
    "~@milkdown/crepe/theme/common/style.css",
  ],
  dark = "auto",
  define = {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  dest = "runtime",
  open = false,
  devServer = { open },
  lintCommand =
    'eslint -c ./eslint.config.ts "./src*/**/*.{ts,js,mjs,cjs,vue}"',
  useFlatConfig = true,
  eslint = { lintCommand, useFlatConfig },
  include = [fileURLToPath(new URL("./src/i18n", import.meta.url))],
  preloadScripts = ["electron-preload"],
  releaseNotesFile = "release-notes.md",
  releaseInfo = { releaseNotesFile },
  releaseType = "release",
  server = false,
  src = "./node_modules/@vuebro/runtime/dist/*",
  strict = true,
  target = { browser },
  targets = [{ dest, src }],
  vueShim = true,
  typescript = { strict, vueShim },
  vueTsc = true;

/* -------------------------------------------------------------------------- */

const extendViteConf = () => ({
  base,
  define,
  plugins: [viteStaticCopy({ targets })],
});

/* -------------------------------------------------------------------------- */

export default defineConfig(() => ({
  animations: ["zoomIn", "zoomOut"],
  boot,
  build: {
    alias,
    extendViteConf,
    target,
    typescript,
    vitePlugins: [
      ["@intlify/unplugin-vue-i18n/vite", { include }],
      ["vite-plugin-checker", { eslint, vueTsc }, { server }],
      ["@vue-macros/reactivity-transform/vite"],
    ],
  },
  css,
  devServer,
  electron: {
    builder: {
      appId,
      publish: [{ provider: "github", releaseType }],
      releaseInfo,
      snap: { publish: [{ channels, provider: "snapStore" }] },
    },
    bundler,
    preloadScripts,
  },
  extras: ["roboto-font", "material-icons"],
  framework: {
    config: { dark },
    plugins: ["Dialog", "Notify"],
  },
}));
