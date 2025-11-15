import type { TPage } from "@vuebro/shared";
import type { Ref } from "vue";

import { sharedStore } from "@vuebro/shared";
import { useFetch } from "@vueuse/core";
import { editor } from "monaco-editor";
import { computed, reactive, ref, toRefs } from "vue";

export type TAppPage = TPage & {
  contenteditable: boolean;
  html: Promise<string> | string;
  jsonld: Promise<editor.ITextModel>;
  sfc: Promise<editor.ITextModel>;
};

const { kvNodes, nodes } = toRefs(sharedStore);

export const { data: manifest } = await useFetch(
  `runtime/.vite/manifest.json`,
).json();

export const domain = ref(""),
  rightDrawer = ref(false),
  selected: Ref<string | undefined> = ref(),
  staticEntries = Object.values(
    manifest.value as Record<string, Record<string, string>>,
  )
    .filter(({ isStaticEntry }) => isStaticEntry)
    .map(({ file, name }) => [name, file]),
  the = computed(
    () =>
      (kvNodes.value[selected.value ?? ""] ?? nodes.value[0]) as
        | TAppPage
        | undefined,
  ),
  urls = reactive(new Map<string, string>());
