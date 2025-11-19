import type { TPage } from "@vuebro/shared";

import { useFetch } from "@vueuse/core";
import { editor } from "monaco-editor";
import { reactive } from "vue";

export type TAppPage = TPage & {
  contenteditable: boolean;
  html: Promise<string> | string;
  jsonld: Promise<editor.ITextModel>;
  sfc: Promise<editor.ITextModel>;
};

const { data } = $(
  useFetch("runtime/.vite/manifest.json").json<
    Record<string, Record<string, string>>
  >(),
);

export const mainStore = reactive({
  domain: "",
  manifest: $$(data),
  rightDrawer: false,
  selected: "",
  urls: new Map<string, string>(),
});
