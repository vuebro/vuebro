<template lang="pug">
.scroll.q-pa-md.col.self-stretch(@vue:mounted="scrollToEnd")
  q-chat-message(
    v-for="{ parts, role, id } in chat.messages",
    :key="id",
    ref="chatMessages",
    :sent="role === 'user'"
  )
    q-markdown(
      v-for="part in parts.filter((part) => part.type === 'text')",
      :key="part.type",
      content-class="line-height-2 min-h-16 no-scroll",
      no-heading-anchor-links,
      no-line-numbers,
      :plugins,
      show-copy,
      :src="part.text"
    )
q-input.q-ma-md(
  v-model="message",
  autofocus,
  autogrow,
  class="max-h-1/3",
  input-class="max-h-full",
  :label="t('How can I help you today?')",
  @keydown.enter.prevent="send"
)
  template(#after)
    q-btn(dense, flat, icon="send", round, @click="send")
</template>
<script setup lang="ts">
import type { ChatTransport, LanguageModel, UIMessage } from "ai";
import type { ComponentPublicInstance } from "vue";

import { createMistral } from "@ai-sdk/mistral";
import { Chat } from "@ai-sdk/vue";
import { useStorage } from "@vueuse/core";
import { convertToModelMessages, streamText } from "ai";
import abbreviation from "markdown-it-abbr";
import deflist from "markdown-it-deflist";
import { full as emoji } from "markdown-it-emoji";
import footnote from "markdown-it-footnote";
import insert from "markdown-it-ins";
import mark from "markdown-it-mark";
import subscript from "markdown-it-sub";
import superscript from "markdown-it-sup";
import taskLists from "markdown-it-task-lists";
import { immediate } from "stores/defaults";
import { nextTick, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";

class CustomChatTransport implements ChatTransport<UIMessage> {
  private model: LanguageModel | undefined;
  constructor(model?: LanguageModel) {
    this.model = model;
  }
  reconnectToStream() {
    return Promise.resolve(null);
  }
  async sendMessages({
    messages,
  }: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]) {
    if (this.model) {
      const result = streamText({
        messages: await convertToModelMessages(messages),
        model: this.model,
        providerOptions: { mistral: { safePrompt: true } },
      });
      return result.toUIMessageStream();
    } else throw new Error("The model is not defined.");
  }
  updateModel(model: LanguageModel | undefined) {
    this.model = model;
  }
}

let message = $ref("");

const chatMessages = $(
  useTemplateRef<ComponentPublicInstance[]>("chatMessages"),
);

const apiKey = useStorage("apiKey", ""),
  scrollToEnd = () => {
    void nextTick(() => {
      chatMessages?.[chatMessages.length - 1]?.$el.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  },
  transport = new CustomChatTransport(),
  chat = new Chat({
    onData: scrollToEnd,
    onFinish: scrollToEnd,
    transport,
  }),
  plugins = [
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
  send = async () => {
    void chat.sendMessage({ text: message });
    message = "";
    await nextTick();
    scrollToEnd();
  },
  { t } = useI18n();

watch(
  apiKey,
  (value) => {
    transport.updateModel(
      value
        ? createMistral({ apiKey: value })("mistral-large-latest")
        : undefined,
    );
  },
  { immediate },
);
</script>

<style scoped>
:deep(.q-message-container) > div {
  width: 100%;
}
:deep(.line-height-2) {
  line-height: 2;
}
:deep(.min-h-16) {
  min-height: 4rem;
}
</style>
