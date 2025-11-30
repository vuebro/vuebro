<template lang="pug">
Milkdown
</template>

<script setup lang="ts">
import { Crepe } from "@milkdown/crepe";
import { Milkdown, useEditor } from "@milkdown/vue";
import * as monaco from "monaco-editor";

const { model } = defineProps<{
  model: Promise<monaco.editor.ITextModel>;
}>();

const sfc = await model;
useEditor((root) => {
  const crepe = new Crepe({ defaultValue: sfc.getValue(), root });
  crepe.on((listener) => {
    listener.markdownUpdated((ctx, markdown) => {
      sfc.setValue(markdown);
    });
  });
  return crepe;
});
</script>
