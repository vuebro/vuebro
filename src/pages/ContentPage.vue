<template lang="pug">
q-drawer(
  v-model="rightDrawer",
  show-if-above,
  side="right",
  :width="drawerWidth"
)
  .column.fit
    q-tabs.text-grey(
      v-model="drawerTab",
      active-color="primary",
      align="justify",
      dense,
      indicator-color="primary",
      narrow-indicator
    )
      q-tab(label="tree", name="tree")
      q-tab(label="ai", name="ai")
    q-separator
    q-tab-panels.col.fit(v-model="drawerTab", keep-alive)
      q-tab-panel.column.no-padding(name="tree")
        v-interactive-tree(v-if="tree && the")
      q-tab-panel.column.no-padding.justify-center(name="ai")
        .column.fit.no-wrap(v-if="apiKey")
          v-ai-chat
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
        .self-center.text-center(v-else)
          q-btn(color="primary", label="AI key", unelevated, @click="clickAI")
          .q-mt-md {{ t("You need an AI key to use this feature") }}
  q-separator.bg-separator.absolute-left.-left-px.cursor-ew-resize(
    v-touch-pan.preserveCursor.prevent.mouse.horizontal="resizeDrawer",
    class="after:pt-[3px] after:text-center after:rounded-[4px] after:bg-gray-400 after:h-[30px] after:content-['∷'] after:top-1/2 after:absolute after:-translate-y-1/2 after:-left-[5px] after:-right-[5px]",
    vertical
  )
q-page.column.full-height(v-if="the")
  q-tabs.text-grey(
    v-model="tab",
    active-color="primary",
    align="justify",
    dense,
    indicator-color="primary",
    narrow-indicator
  )
    q-tab(label="wysiwyg", name="wysiwyg")
    q-tab(label="vue", name="vue")
  q-separator
  q-tab-panels.full-width.col(v-if="selected", v-model="tab")
    q-tab-panel(name="wysiwyg")
      Suspense
        milkdown-provider
          v-milkdown-editor.full-height.scroll
        template(#fallback)
          q-inner-loading(showing)
            q-spinner-hourglass
    q-tab-panel(name="vue")
      Suspense
        v-monaco-editor(ref="monaco")
          template(#fallback)
            q-inner-loading(showing)
              q-spinner-hourglass
q-page.column.full-height.bg-light(v-else)
  q-inner-loading(showing)
    q-spinner-hourglass
</template>
<script setup lang="ts">
import type { MistralProvider } from "@ai-sdk/mistral";
import type { TLog } from "@vuebro/shared";
import type { ModelMessage } from "ai";
import type { TouchPanValue } from "quasar";
import type { TAppPage } from "stores/main";

import { createMistral } from "@ai-sdk/mistral";
import { MilkdownProvider } from "@milkdown/vue";
import { sharedStore } from "@vuebro/shared";
import { useStorage } from "@vueuse/core";
import {
  extractReasoningMiddleware,
  generateText,
  wrapLanguageModel,
} from "ai";
import VAiChat from "components/VAiChat.vue";
import VInteractiveTree from "components/VInteractiveTree.vue";
import VMilkdownEditor from "components/VMilkdownEditor.vue";
import VMonacoEditor from "components/VMonacoEditor.vue";
import { useQuasar } from "quasar";
import {
  cancel,
  html,
  immediate,
  mergeDefaults,
  persistent,
} from "stores/defaults";
import { mainStore } from "stores/main";
import { ref, toRefs, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";

const sharedRefs = toRefs(sharedStore);
const $q = useQuasar(),
  drawerTab = ref("tree"),
  length = 20,
  monaco = $(useTemplateRef<InstanceType<typeof VMonacoEditor>>("monaco")),
  { log: defaultLog } = sharedRefs,
  { t } = useI18n();

const { kvNodes, nodes, tree } = $(sharedRefs);
const { rightDrawer, selected } = $(toRefs(mainStore));

const apiKey = useStorage("apiKey", ""),
  log = useStorage<TLog>(() => tree[0]?.id ?? "", defaultLog, localStorage, {
    mergeDefaults,
  }),
  tab = $ref("wysiwyg"),
  the = $computed(
    () => (kvNodes[selected] ?? nodes[0]) as TAppPage | undefined,
  );

let initialDrawerWidth = 300,
  drawerWidth = $ref(initialDrawerWidth),
  message = $ref(""),
  mistral: MistralProvider | undefined;

const clickAI = () => {
    $q.dialog({
      cancel,
      html,
      message: `${t("Get Mistral API Key")} at <a class="underline text-blue" href="https://console.mistral.ai/api-keys" target="_blank" rel="noreferrer">https://console.mistral.ai/api-keys</a>`,
      persistent,
      prompt: {
        hint: t("paste Mistral API Key only on a trusted computer"),
        model: apiKey.value,
        type: "password",
      },
      title: "Mistral API Key",
    }).onOk((data: string) => {
      apiKey.value = data;
    });
  },
  resizeDrawer: TouchPanValue = ({ isFirst, offset: { x } = {} } = {}) => {
    if (isFirst) initialDrawerWidth = drawerWidth;
    if (x) {
      const width = initialDrawerWidth - x;
      if (width > 300) drawerWidth = width;
    }
  },
  send = async () => {
    if (mistral && message) {
      const content = [{ text: message, type: "text" }],
        { messages, system } = log.value;
      if (tab === "vue" && monaco) {
        const text = (monaco.getSelection() ?? "") as string;
        if (text)
          content.unshift({
            text: `\`\`\`markdown\n${text}\n\`\`\``,
            type: "text",
          });
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

watch(
  apiKey,
  (value) => {
    mistral = value ? createMistral({ apiKey: value }) : undefined;
  },
  { immediate },
);
</script>

<style scoped>
.q-textarea :deep(.q-field__control) {
  height: 100% !important;
}
</style>
