<template lang="pug">
template(v-if="log")
  .scroll.q-pa-md.col.self-stretch(@vue:mounted="scrollToEnd")
    q-chat-message(
      v-for="({ content, role }, i) in [...log.messages].reverse()",
      :key="i",
      ref="chatMessages",
      :sent="role === 'user'"
    )
      div(v-for="({ text }, j) in content", :key="j")
        q-markdown(
          content-class="line-height-2",
          no-heading-anchor-links,
          no-line-numbers,
          :plugins,
          :src="text"
        )
        q-btn(
          flat,
          icon="content_copy",
          round,
          size="xs",
          @click="clipboard(text)"
        )
        q-btn(
          flat,
          icon="delete",
          round,
          size="xs",
          @click="content.length < 2 ? log.messages.splice(log.messages.length - i - 1, 1) : log.messages[log.messages.length - i - 1]?.content.splice(j, 1)"
        )
</template>
<script setup lang="ts">
import type { TLog } from "@vuebro/shared";
import type { ComponentPublicInstance } from "vue";

import mermaid from "@datatraccorporation/markdown-it-mermaid";
import { sharedStore } from "@vuebro/shared";
import { useStorage } from "@vueuse/core";
import abbreviation from "markdown-it-abbr";
import deflist from "markdown-it-deflist";
import { full as emoji } from "markdown-it-emoji";
import footnote from "markdown-it-footnote";
import insert from "markdown-it-ins";
import mark from "markdown-it-mark";
import subscript from "markdown-it-sub";
import superscript from "markdown-it-sup";
import taskLists from "markdown-it-task-lists";
import { deep, mergeDefaults } from "stores/defaults";
import { nextTick, toRefs, useTemplateRef, watch } from "vue";

const sharedRefs = toRefs(sharedStore),
  { log: defaultLog } = sharedRefs,
  { tree } = $(sharedRefs);

const chatMessages = $(
    useTemplateRef<ComponentPublicInstance[]>("chatMessages"),
  ),
  clipboard = async (data: string) => {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([data], { type: "text/html" }),
        "text/plain": new Blob([data], { type: "text/plain" }),
      }),
    ]);
  },
  log = useStorage<TLog>(() => tree[0]?.id ?? "", defaultLog, localStorage, {
    mergeDefaults,
  }),
  plugins = [
    mermaid,
    abbreviation,
    deflist,
    emoji,
    footnote,
    insert,
    mark,
    subscript,
    superscript,
    taskLists,
  ],
  scrollToEnd = () => {
    (
      chatMessages?.[chatMessages.length - 1]?.$el as HTMLElement | undefined
    )?.scrollIntoView();
  };

watch(
  log,
  async () => {
    await nextTick();
    scrollToEnd();
  },
  { deep },
);
</script>

<style scoped>
:deep(.q-message-container) > div {
  width: 100%;
}
.line-height-2 {
  line-height: 2;
}
</style>
