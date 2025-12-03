<template lang="pug">
.size-full(ref="monacoRef")
</template>

<script setup lang="ts">
import type { CompletionRegistration } from "monacopilot";

import * as monaco from "monaco-editor";
import { CompletionCopilot, registerCompletion } from "monacopilot";
import { immediate } from "stores/defaults";
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";

let completion: CompletionRegistration | null = null,
  editor: monaco.editor.IStandaloneCodeEditor | null = null;

const { apiKey, model, technologies } = defineProps<{
  apiKey: string;
  model: Promise<monaco.editor.ITextModel>;
  technologies: string[];
}>();

const monacoRef = $(useTemplateRef<HTMLElement>("monacoRef"));

watch(
  () => model,
  async () => {
    editor?.setModel(await model);
  },
);

onMounted(async () => {
  editor =
    monacoRef &&
    monaco.editor.create(monacoRef, {
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
      detectIndentation: false,
      fixedOverflowWidgets: true,
      formatOnPaste: true,
      formatOnType: true,
      model: await model,
      scrollBeyondLastLine: false,
      tabSize: 2,
      unicodeHighlight: { ambiguousCharacters: false },
    });
  watch(
    [() => apiKey, () => technologies],
    async () => {
      completion?.deregister();
      completion = null;
      if (apiKey && editor) {
        const copilot = new CompletionCopilot(apiKey, {
            model: "codestral",
            provider: "mistral",
          }),
          {
            uri: { path },
          } = await model;
        completion = registerCompletion(monaco, editor, {
          filename: path,
          language: (await model).getLanguageId(),
          onError: () => {
            // console.error(error);
          },
          requestHandler: ({ body }) => copilot.complete({ body }),
          technologies,
        });
      }
    },
    { immediate },
  );
  if (editor) editor.focus();
});

onBeforeUnmount(() => {
  completion?.deregister();
  completion = null;
  editor?.dispose();
  editor = null;
});

defineExpose({
  getSelection: async () => {
    const selection = editor?.getSelection() ?? null;
    const value =
      selection && !selection.isEmpty()
        ? (await model).getValueInRange(selection)
        : null;
    editor?.trigger("editor", "cancelSelection", {});
    return value;
  },
});
</script>
