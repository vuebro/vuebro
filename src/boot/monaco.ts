import type monacoNs from "monaco-editor-core";

import { shikiToMonaco } from "@shikijs/monaco";
import configureMonacoSFC from "@vuebro/monaco-sfc";
// eslint-disable-next-line import-x/default
import VueWorker from "@vuebro/monaco-sfc/vue.worker?worker";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
// eslint-disable-next-line import-x/default
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import {
  configureMonacoTailwindcss,
  defaultLanguageSelector,
} from "monaco-tailwind";
import TailwindWorker from "monaco-tailwind/tailwind.worker?worker";
import { createHighlighter } from "shiki";

window.MonacoEnvironment = {
  getWorker: (workerId: string, label: string) => {
    switch (label) {
      case "json":
        return new JsonWorker();
      case "markdown":
      case "vue":
        return new VueWorker();
      case "tailwindcss":
        return new TailwindWorker();
      default:
        return new EditorWorker();
    }
  },
};

configureMonacoSFC(monaco as typeof monacoNs);
configureMonacoTailwindcss(monaco, {
  languageSelector: [...defaultLanguageSelector, "vue"],
});

shikiToMonaco(
  await createHighlighter({
    langs: ["vue", "json", "jsx", "tsx", "md"],
    themes: ["dark-plus", "light-plus"],
  }),
  monaco as typeof monacoNs,
);
