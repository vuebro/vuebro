<template lang="pug">
template(v-if="log")
  .scroll.q-pa-md.col.self-stretch(@vue:mounted="scrollToEnd")
    q-chat-message(
      v-for="({ content, role }, i) in list",
      :key="i",
      ref="chatMessages",
      :sent="role === 'user'"
    )
      div(v-for="(msg, j) in content", :key="j")
        // eslint-disable-next-line vue/no-v-html
        .prose.text-xs.select-text(v-html="msg")
        q-btn(
          flat,
          icon="content_copy",
          round,
          size="xs",
          @click="clipboard(msg)"
        )
        q-btn(
          flat,
          icon="delete",
          round,
          size="xs",
          @click="content.length < 2 ? log.messages.splice(log.messages.length - i - 1, 1) : log.messages[log.messages.length - i - 1]?.content.splice(j, 1)"
        )
  q-input.q-ma-sm(
    v-model="message",
    autofocus,
    autogrow,
    class="max-h-1/3",
    dense,
    input-class="max-h-full",
    :label="t('How can I help you today?')",
    @keyup.ctrl.enter="send"
  )
    template(#prepend)
      q-icon.cursor-pointer(name="person")
        q-tooltip {{ t("Describe AI behavior") }}
        q-popup-edit(
          v-slot="scope",
          v-model="log.system",
          anchor="bottom end",
          buttons
        )
          q-input(
            v-model="scope.value",
            autofocus,
            dense,
            :label="t('Describe AI behavior')",
            type="textarea"
          )
    template(#after)
      q-btn(dense, flat, icon="send", round, @click="send")
</template>
<script setup lang="ts">
import type { MistralProvider } from "@ai-sdk/mistral";
import type { TLog } from "@vuebro/shared";
import type { RemovableRef } from "@vueuse/core";
import type { ModelMessage } from "ai";
import type { ComponentPublicInstance } from "vue";

import { createMistral } from "@ai-sdk/mistral";
import { sharedStore } from "@vuebro/shared";
import { useStorage } from "@vueuse/core";
import {
  extractReasoningMiddleware,
  generateText,
  wrapLanguageModel,
} from "ai";
import dompurify from "dompurify";
import { marked } from "marked";
import markedShiki from "marked-shiki";
import { useQuasar } from "quasar";
import { createHighlighter } from "shiki";
import VSourceCode from "src/components/VSourceCode.vue";
import { deep, immediate, mergeDefaults, once } from "stores/defaults";
import { nextTick, toRefs, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";

const { apiKey } = defineProps<{
  apiKey: string;
}>();

const sharedRefs = toRefs(sharedStore),
  { tree } = $(sharedRefs);
const { log: defaultLog } = sharedRefs;

const chatMessages = $(
  useTemplateRef<ComponentPublicInstance[]>("chatMessages"),
);
const jsonldRef = $(
  useTemplateRef<InstanceType<typeof VSourceCode>>("jsonldRef"),
);
const vueRef = $(useTemplateRef<InstanceType<typeof VSourceCode>>("vueRef"));

let list = $ref<{ content: string[]; role: string }[]>([]),
  message = $ref("");

const $q = useQuasar(),
  clipboard = async (data: string) => {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([data], { type: "text/html" }),
        "text/plain": new Blob([data], { type: "text/plain" }),
      }),
    ]);
  },
  highlighter = await createHighlighter({
    langs: ["vue", "json", "jsx", "tsx", "html"],
    themes: ["dark-plus", "light-plus"],
  }),
  length = 20,
  markedWithShiki = marked.use(
    markedShiki({
      highlight: (code, lang) =>
        highlighter.codeToHtml(code, {
          lang,
          theme: "light-plus",
        }),
    }),
  ),
  scrollToEnd = () => {
    (
      chatMessages?.[chatMessages.length - 1]?.$el as HTMLElement | undefined
    )?.scrollIntoView();
  },
  tab = $ref("wysiwyg"),
  { t } = useI18n();

let log: RemovableRef<TLog> | undefined, mistral: MistralProvider | undefined;

const initLog = () => {
  if (tree[0]?.id) {
    log = useStorage(tree[0].id, defaultLog, localStorage, {
      mergeDefaults,
    });
    watch(
      () => [...(log?.value.messages ?? [])],
      async (value, oldValue) => {
        list = await Promise.all(
          value
            .map(async ({ content, role }) => ({
              content: await Promise.all(
                content.map(async ({ text }) =>
                  dompurify.sanitize(await markedWithShiki.parse(text)),
                ),
              ),
              role,
            }))
            .toReversed(),
        );
        if (oldValue && value.length > oldValue.length) {
          await nextTick();
          scrollToEnd();
        }
      },
      { deep, flush: "post", immediate },
    );
  }
};

if (tree[0]?.id) initLog();
else watch(() => tree[0]?.id, initLog, { once });

watch(
  $$(apiKey),
  (value) => {
    mistral = value ? createMistral({ apiKey: value }) : undefined;
  },
  { immediate },
);

const send = async () => {
  if (mistral && log && message) {
    const content = [{ text: message, type: "text" }],
      { messages, system } = log.value;
    if (tab === "vue" && vueRef) {
      const text = ((await vueRef.getSelection()) ?? "") as string;
      if (text)
        content.unshift({ text: `\`\`\`vue\n${text}\n\`\`\``, type: "text" });
    }
    if (tab === "jsonld" && jsonldRef) {
      const text = ((await jsonldRef.getSelection()) ?? "") as string;
      if (text)
        content.unshift({ text: `\`\`\`json\n${text}\n\`\`\``, type: "text" });
    }
    messages.unshift({ content, role: "user" });
    message = "";
    if (messages.length > length) messages.length = length;
    try {
      const { text } = await generateText({
        messages: messages.toReversed() as ModelMessage[],
        model: wrapLanguageModel({
          middleware: extractReasoningMiddleware({ tagName: "think" }),
          model: mistral("magistral-medium-latest"),
        }),
        system,
      });
      messages.unshift({
        content: [{ text, type: "text" }],
        role: "assistant",
      });
    } catch (err) {
      const { message } = err as Error;
      $q.notify({ message });
    }
  }
};
</script>

<style scoped>
:deep(pre) {
  white-space: break-spaces;
}
.q-textarea :deep(.q-field__control) {
  height: 100% !important;
}
</style>
