import { shikiToMonaco } from "@shikijs/monaco";
import configureMonacoSFC from "@vuebro/monaco-sfc";
// eslint-disable-next-line import-x/default
import VueWorker from "@vuebro/monaco-sfc/vue.worker?worker";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { configureMonacoTailwindcss } from "monaco-tailwind";
import TailwindWorker from "monaco-tailwind/tailwind.worker?worker";
import { highlighter } from "stores/main";

window.MonacoEnvironment = {
  getWorker: (workerId: string, label: string) => {
    switch (label) {
      case "tailwindcss":
        return new TailwindWorker();
      case "vue":
        return new VueWorker();
      default:
        return new EditorWorker();
    }
  },
};

configureMonacoSFC(monaco);
configureMonacoTailwindcss(monaco, { languageSelector: ["markdown"] });
shikiToMonaco(highlighter, monaco);
