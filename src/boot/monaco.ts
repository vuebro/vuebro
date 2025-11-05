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
  /**
   * Returns a new web worker instance based on the given label
   *
   * @param workerId - The ID of the worker
   * @param label - The label indicating the type of worker to create
   * @returns - A new web worker instance
   */
  getWorker: (workerId: string, label: string) => {
    switch (label) {
      case "json":
        return new JsonWorker();
      case "tailwindcss":
        return new TailwindWorker();
      case "vue":
        return new VueWorker();
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
    langs: ["vue", "json", "jsx", "tsx"],
    themes: ["dark-plus", "light-plus"],
  }),
  monaco as typeof monacoNs,
);
