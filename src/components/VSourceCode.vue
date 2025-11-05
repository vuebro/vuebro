<template lang="pug">
.size-full(ref="monacoRef")
</template>

<script setup lang="ts">
import type { CompletionRegistration } from "monacopilot";
import type { ThemeRegistrationRaw } from "shiki";

import * as monaco from "monaco-editor";
import { CompletionCopilot, registerCompletion } from "monacopilot";
import themeLight from "shiki/themes/light-plus.mjs";
import { immediate } from "stores/defaults";
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";

let completion: CompletionRegistration | null = null,
  editor: monaco.editor.IStandaloneCodeEditor | null = null;

const ambiguousCharacters = false,
  automaticLayout = true,
  fixedOverflowWidgets = true,
  monacoRef = useTemplateRef<HTMLElement>("monacoRef"),
  scrollBeyondLastLine = false,
  unicodeHighlight = { ambiguousCharacters },
  { apiKey, model, technologies } = defineProps<{
    apiKey: string;
    model: Promise<monaco.editor.ITextModel>;
    technologies: string[];
  }>(),
  { name: theme = "light-plus" }: ThemeRegistrationRaw = themeLight;

watch(
  () => model,
  async () => {
    editor?.setModel(await model);
  },
);

onMounted(async () => {
  editor =
    monacoRef.value &&
    monaco.editor.create(monacoRef.value, {
      automaticLayout,
      fixedOverflowWidgets,
      model: await model,
      scrollBeyondLastLine,
      theme,
      unicodeHighlight,
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
          /**
           * Handles errors from the completion service
           */
          onError: () => {
            // console.error(error);
          },
          /**
           * Handles the request for code completion
           *
           * @param root0 - The request object
           * @param root0.body - The request body
           * @returns - The completion response
           */
          requestHandler: ({ body }) => copilot.complete({ body }),
          technologies,
        });
      }
    },
    { immediate },
  );
  if (editor) {
    editor.focus();
    const { _themeService: themeService } = editor as unknown as Record<
      string,
      Record<string, Record<string, ((...args: never) => unknown) | boolean>>
    >;
    if (themeService) {
      const { _theme: t } = themeService;
      if (t) {
        t.semanticHighlighting = true;
        /**
         * Gets the token style metadata for syntax highlighting
         *
         * @param type - The token type
         * @param modifiers - The token modifiers
         * @returns - The token style metadata
         */
        t.getTokenStyleMetadata = (type: string, modifiers: string[]) => {
          let foreground = 0;
          switch (type) {
            case "class":
              foreground = 11;
              break;
            case "function":
            case "method":
              foreground = 12;
              break;
            case "property":
            case "variable":
              foreground = modifiers.includes("readonly") ? 19 : 9;
              break;
            default:
          }
          return { foreground };
        };
      }
    }
  }
});

onBeforeUnmount(() => {
  completion?.deregister();
  completion = null;
  editor?.dispose();
  editor = null;
});

defineExpose({
  /**
   * Gets the currently selected text in the editor
   *
   * @returns The selected text or null if no selection
   */
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
