import type { TPage } from "@vuebro/shared";

import { sharedStore } from "@vuebro/shared";
import { useFetch } from "@vueuse/core";
import { editor } from "monaco-editor";
import { computed, reactive, toRefs } from "vue";

export type TAppPage = TPage & {
  contenteditable: boolean;
  html: Promise<string> | string;
  jsonld: Promise<editor.ITextModel>;
  sfc: Promise<editor.ITextModel>;
};

const { kvNodes, nodes } = $(toRefs(sharedStore));

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
  staticEntries: computed(
    () =>
      data &&
      Object.values(data)
        .filter(({ isStaticEntry }) => isStaticEntry)
        .map(({ file, name }) => [name, file]),
  ),
  the: computed(
    (): TAppPage | undefined =>
      (kvNodes[mainStore.selected] ?? nodes[0]) as TAppPage | undefined,
  ),
  urls: new Map<string, string>(),
});
