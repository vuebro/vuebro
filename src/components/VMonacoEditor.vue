<template lang="pug">
.full-width.full-height(ref="monacoRef")
</template>

<script setup lang="ts">
import type { CompletionRegistration } from "monacopilot";

import { useStorage } from "@vueuse/core";
import { split } from "hexo-front-matter";
import * as monaco from "monaco-editor";
import { CompletionCopilot, registerCompletion } from "monacopilot";
import { storeToRefs } from "pinia";
import { useQuasar } from "quasar";
import { immediate } from "stores/defaults";
import { useMainStore } from "stores/main";
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";

let completion: CompletionRegistration | null = null,
  editor: monaco.editor.IStandaloneCodeEditor | null = null,
  model: monaco.editor.ITextModel | null = null;

const monacoRef = $(useTemplateRef<HTMLElement>("monacoRef"));
const $q = useQuasar(),
  apiKey = useStorage("apiKey", ""),
  frontmatter = (value: string) => {
    if (value && model) {
      const { data, prefixSeparator, separator } = split(model.getValue());
      if (data && separator === "---" && prefixSeparator)
        monaco.editor.setModelMarkers(model, "frontmatter", [
          {
            endColumn: 1,
            endLineNumber: data.split("\n").length + 2,
            message: value,
            severity: monaco.MarkerSeverity.Error,
            startColumn: 1,
            startLineNumber: 2,
          },
        ]);
    } else monaco.editor.removeAllMarkers("frontmatter");
  },
  mainStore = useMainStore(),
  monacopilot = (value: string) => {
    completion?.deregister();
    completion = null;
    if (value && editor && model) {
      const copilot = new CompletionCopilot(value, {
          model: "codestral",
          provider: "mistral",
        }),
        {
          uri: { path },
        } = model;
      completion = registerCompletion(monaco, editor, {
        filename: path,
        language: model.getLanguageId(),
        onError: () => {
          // console.error(error);
        },
        requestHandler: ({ body }) => copilot.complete({ body }),
        technologies: [
          "vue",
          "tailwindcss",
          "markdown",
          "mdc (markdown components)",
        ],
      });
    }
  },
  { getModel } = mainStore,
  { message, selected } = storeToRefs(mainStore);

defineExpose({
  getSelection: () => {
    const selection = editor?.getSelection() ?? null;
    const value =
      selection && !selection.isEmpty()
        ? (model?.getValueInRange(selection) ?? null)
        : null;
    editor?.trigger("editor", "cancelSelection", {});
    return value;
  },
});

watch(apiKey, monacopilot);
watch(message, frontmatter);

watch(
  () => $q.dark.isActive,
  (val) => {
    monaco.editor.setTheme(val ? "nord" : "github-light-default");
  },
  { immediate },
);

onMounted(() => {
  watch(
    selected,
    async (value) => {
      model = await getModel(value);
      if (editor) editor.setModel(model);
      else {
        editor =
          monacoRef &&
          monaco.editor.create(monacoRef, {
            automaticLayout: true,
            bracketPairColorization: { enabled: true },
            detectIndentation: false,
            fixedOverflowWidgets: true,
            formatOnPaste: true,
            formatOnType: true,
            model,
            scrollBeyondLastLine: false,
            tabSize: 2,
            unicodeHighlight: { ambiguousCharacters: false },
          });
        monacopilot(apiKey.value);
        frontmatter(message.value);
      }
      editor?.focus();
    },
    { immediate },
  );
});

onBeforeUnmount(() => {
  completion?.deregister();
  completion = null;
  editor?.dispose();
  editor = null;
});
</script>
