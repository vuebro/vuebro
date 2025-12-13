<template lang="pug">
.size-full(ref="monacoRef")
</template>

<script setup lang="ts">
import type { CompletionRegistration } from "monacopilot";

import { useStorage } from "@vueuse/core";
import * as monaco from "monaco-editor";
import { CompletionCopilot, registerCompletion } from "monacopilot";
import { immediate } from "stores/defaults";
import { getModel, mainStore } from "stores/main";
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";

let completion: CompletionRegistration | null = null,
  editor: monaco.editor.IStandaloneCodeEditor | null = null,
  model: monaco.editor.ITextModel | null = null;

const monacoRef = $(useTemplateRef<HTMLElement>("monacoRef"));
const apiKey = useStorage("apiKey", ""),
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
        technologies: ["vue", "tailwindcss", "vitepress"],
      });
    }
  },
  selected = $toRef(mainStore, "selected");

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

onMounted(() => {
  watch(
    $$(selected),
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
