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
      q-tab(label="seo", name="seo")
      q-tab(label="ai", name="ai")
    q-separator
    q-tab-panels.col.fit(v-model="drawerTab", keep-alive)
      q-tab-panel.column.no-padding(name="seo")
        q-list.fit(v-if="tree && the")
          q-expansion-item(
            :label="t('Content Tree')",
            default-opened,
            header-class="text-primary",
            icon="account_tree"
          )
            v-interactive-tree
          q-separator
          q-card(flat)
            q-item.text-teal
              q-item-section(avatar)
                q-icon(name="description")
              q-item-section
                q-item-label {{ t("Page Settings") }}
            q-card-section
              q-list
                q-item(v-ripple, tag="label")
                  q-item-section(avatar)
                    q-checkbox(v-model="the.flat")
                  q-item-section
                    q-item-label flat
                    q-item-label(caption) flat
                q-select(
                  v-model.trim="the.class",
                  hide-dropdown-icon,
                  label="class",
                  multiple,
                  new-value-mode="add",
                  stack-label,
                  use-chips,
                  use-input
                )
          q-separator
          q-card(flat)
            q-item.text-teal
              q-item-section(avatar)
                q-icon(name="travel_explore")
              q-item-section
                q-item-label {{ t("SEO Settings") }}
            q-card-section
              q-select(
                v-model="the.type",
                :label="t('The type of media of your content')",
                :options="types",
                clearable,
                hint="type"
              )
              q-input(
                v-model.trim="the.header",
                :label="t('Page Header')",
                hint="header",
                clearable
              )
              q-input(
                v-model.trim="the.description",
                :label="t('Page Description')",
                autogrow,
                hint="description",
                type="textarea",
                clearable
              )
              q-select(
                v-model.trim="the.keywords",
                :label="t('Keywords')",
                hide-dropdown-icon,
                hint="keywords",
                multiple,
                new-value-mode="add",
                stack-label,
                use-chips,
                use-input
              )
              q-input(
                v-model.trim="loc",
                :rules,
                :label="t('Permanent Link')",
                hint="loc",
                prefix="/",
                type="url",
                clearable
              )
              q-select(
                v-model="the.changefreq",
                :label="t('Change Frequency')",
                :options="changefreq",
                clearable,
                hint="changefreq"
              )
              q-input(
                v-model.number="the.priority",
                :label="t('Priority')",
                hint="priority",
                max="1",
                min="0",
                step="0.1",
                type="number"
              )
              q-input(
                v-model="the.lastmod",
                :label="t('Last Modification')",
                clearable,
                hint="lastmod",
                type="datetime-local"
              )
              q-input(
                v-model.trim="the.icon",
                :label="t('Icon')",
                clearable,
                hint="icon"
              )
                template(#prepend)
                  Icon.q-icon.cursor-pointer(
                    :icon="the.icon || 'mdi:tray-arrow-up'"
                  )
                  q-popup-proxy.column.items-center.justify-center
                    q-input.q-ma-md(
                      v-model="filter",
                      :label="t('Search...')",
                      clearable,
                      dense
                    )
                    q-icon-picker(
                      v-model="icon",
                      v-model:model-pagination="pagination",
                      :filter,
                      :icons,
                      dense,
                      tooltips
                    )
      q-tab-panel.column.no-padding.justify-center(name="ai")
        .column.fit.no-wrap(v-if="apiKey && log", @vue:mounted="scrollToEnd")
          .scroll.q-pa-md.col.self-stretch
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
                  round,
                  icon="content_copy",
                  size="xs",
                  @click="clipboard(msg)"
                )
                q-btn(
                  flat,
                  round,
                  icon="delete",
                  size="xs",
                  @click="content.length < 2 ? log.messages.splice(log.messages.length - i - 1, 1) : log.messages[log.messages.length - i - 1]?.content.splice(j, 1)"
                )
          q-input.q-ma-sm(
            v-model="message",
            :label="t('How can I help you today?')",
            autogrow,
            dense,
            autofocus,
            class="max-h-1/3",
            input-class="max-h-full",
            @keyup.ctrl.enter="send"
          )
            template(#prepend)
              q-icon.cursor-pointer(name="person")
                q-tooltip {{ t("Describe AI behavior") }}
                q-popup-edit(
                  v-slot="scope",
                  v-model="log.system",
                  buttons,
                  anchor="bottom end"
                )
                  q-input(
                    v-model="scope.value",
                    dense,
                    autofocus,
                    type="textarea",
                    :label="t('Describe AI behavior')"
                  )
            template(#after)
              q-btn(round, dense, flat, icon="send", @click="send")
        .self-center.text-center(v-else)
          q-btn(unelevated, color="primary", label="AI key", @click="clickAI")
          .q-mt-md {{ t("You need an AI key to use this feature") }}
  q-separator.bg-separator.absolute-left.-left-px.cursor-ew-resize(
    v-touch-pan.preserveCursor.prevent.mouse.horizontal="resizeDrawer",
    vertical,
    class="after:absolute after:top-1/2 after:-right-[5px] after:-left-[5px] after:h-[30px] after:-translate-y-1/2 after:rounded-[4px] after:bg-gray-400 after:pt-[3px] after:text-center after:content-['∷']"
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
    q-tab(label="json-ld", name="jsonld")
    q-tab(label="images", name="images")
  q-separator
  q-tab-panels.full-width.col(v-model="tab")
    q-tab-panel.column(name="wysiwyg")
      Suspense
        v-wysiwyg(:id="the.id", v-model="the.html")
        template(#fallback)
          q-inner-loading(showing)
            q-spinner-hourglass
    q-tab-panel(name="vue")
      Suspense
        v-source-code(ref="vueRef", :model="the.sfc", :api-key, :technologies)
          template(#fallback)
            q-inner-loading(showing)
              q-spinner-hourglass
    q-tab-panel(name="jsonld")
      Suspense
        v-source-code(
          ref="jsonldRef",
          :model="the.jsonld",
          :api-key,
          :technologies="['json-ld']"
        )
          template(#fallback)
            q-inner-loading(showing)
              q-spinner-hourglass
    q-tab-panel(name="images")
      v-images
q-page.column.full-height.bg-light(v-else)
  q-inner-loading(showing)
    q-spinner-hourglass
</template>
<script setup lang="ts">
import type { MistralProvider } from "@ai-sdk/mistral";
import type { IconNameArray } from "@quasar/quasar-ui-qiconpicker";
import type { TLog } from "@vuebro/shared";
import type { RemovableRef } from "@vueuse/core";
import type { ModelMessage } from "ai";
import type { ValidationRule } from "quasar";
import type { ComponentPublicInstance } from "vue";

import { createMistral } from "@ai-sdk/mistral";
import { Icon } from "@iconify/vue";
import mdi from "@quasar/quasar-ui-qiconpicker/src/components/icon-set/mdi-v6";
import { log as defaultLog, importmap, nodes, tree } from "@vuebro/shared";
import { useStorage } from "@vueuse/core";
import {
  extractReasoningMiddleware,
  generateText,
  wrapLanguageModel,
} from "ai";
import changefreq from "assets/changefreq.json";
import types from "assets/types.json";
import VImages from "components/VImages.vue";
import VInteractiveTree from "components/VInteractiveTree.vue";
import VWysiwyg from "components/VWysiwyg.vue";
import dompurify from "dompurify";
import { marked } from "marked";
import markedShiki from "marked-shiki";
import { useQuasar } from "quasar";
import { createHighlighter } from "shiki";
import VSourceCode from "src/components/VSourceCode.vue";
import { rightDrawer, the } from "stores/app";
import {
  cancel,
  deep,
  html,
  immediate,
  itemsPerPage,
  mergeDefaults,
  once,
  page,
  persistent,
} from "stores/defaults";
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";

const $q = useQuasar(),
  apiKey = useStorage("apiKey", ""),
  chatMessages = useTemplateRef<ComponentPublicInstance[]>("chatMessages"),
  /**
   * Copies data to the clipboard
   *
   * @param data - The data to be copied to clipboard
   * @returns A promise that resolves when the data is copied
   */
  clipboard = async (data: string) => {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([data], { type: "text/html" }),
        "text/plain": new Blob([data], { type: "text/plain" }),
      }),
    ]);
  },
  drawerTab = ref("seo"),
  filter = ref(""),
  highlighter = await createHighlighter({
    langs: ["vue", "json", "jsx", "tsx", "html"],
    themes: ["dark-plus", "light-plus"],
  }),
  icon = computed({
    /**
     * Gets the icon value with MDI prefix replaced by MDI- format
     *
     * @returns The formatted icon value
     */
    get() {
      return the.value?.icon?.replace(/^mdi:/, "mdi-");
    },
    /**
     * Sets the icon value, converting MDI- format back to MDI: prefix
     *
     * @param value - The icon value to set
     */
    set(value: string | undefined) {
      if (value && the.value) the.value.icon = value.replace(/^mdi-/, "mdi:");
    },
  }),
  id = computed(() => tree[0]?.id ?? ""),
  jsonldRef = useTemplateRef<InstanceType<typeof VSourceCode>>("jsonldRef"),
  length = 20,
  list = ref<{ content: string[]; role: string }[]>([]),
  loc = computed({
    /**
     * Gets the location value
     *
     * @returns The location value or null if not set
     */
    get() {
      return the.value?.loc ?? null;
    },
    /**
     * Sets the location value, removing leading and trailing slashes
     *
     * @param value - The location value to set
     */
    set(value: null | string) {
      if (the.value)
        the.value.loc = value?.replace(/((?=(\/+))\2)$|(^\/+)/g, "") ?? null;
    },
  }),
  markedWithShiki = marked.use(
    markedShiki({
      /**
       * Highlights code with syntax highlighting
       *
       * @param code - The code to highlight
       * @param lang - The language of the code
       * @returns The highlighted HTML code
       */
      highlight: (code, lang) =>
        highlighter.codeToHtml(code, {
          lang,
          theme: "light-plus",
        }),
    }),
  ),
  message = ref(""),
  pagination = ref({ itemsPerPage, page }),
  /**
   * Scrolls to the end of the chat messages container
   */
  scrollToEnd = () => {
    (
      chatMessages.value?.[chatMessages.value.length - 1]?.$el as
        | HTMLElement
        | undefined
    )?.scrollIntoView();
  },
  tab = ref("wysiwyg"),
  technologies = computed(() => [
    "tailwindcss",
    ...Object.keys(importmap.imports).filter((value) => value !== "vue"),
  ]),
  vueRef = useTemplateRef<InstanceType<typeof VSourceCode>>("vueRef"),
  { icons } = mdi as Record<"icons", IconNameArray>,
  { t } = useI18n();

let initialDrawerWidth = 300,
  log: RemovableRef<TLog> | undefined,
  mistral: MistralProvider | undefined;

/**
 * Handles click event to open AI key dialog
 */
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
  drawerWidth = ref(initialDrawerWidth),
  /**
   * Initializes the log for the current page
   */
  initLog = () => {
    log = useStorage(id, defaultLog, localStorage, { mergeDefaults });
    watch(
      () => [...(log?.value.messages ?? [])],
      async (value, oldValue) => {
        list.value = await Promise.all(
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
  },
  /**
   * Handles drawer resize events
   *
   * @param params - The resize parameters
   * @param params.isFirst - Whether this is the first resize event
   * @param params.offset - The offset information
   * @param params.offset.x - The x offset value
   */
  resizeDrawer = ({
    isFirst,
    offset: { x },
  }: {
    isFirst: boolean;
    offset: { x: number };
  }) => {
    if (isFirst) initialDrawerWidth = drawerWidth.value;
    const width = initialDrawerWidth - x;
    if (width > 300) drawerWidth.value = width;
  },
  /**
   * Validation rules for the form inputs
   */
  rules: ValidationRule[] = [
    /**
     * Validates that the page name is unique
     *
     * @param v - The value to validate
     * @returns True if valid, error message otherwise
     */
    (v) =>
      !v ||
      !nodes.value.find(
        (element) =>
          element.path === v ||
          (element.id !== the.value?.id && element.loc === v),
      ) ||
      t("That name is already in use"),
    /**
     * Validates that the page name doesn't contain prohibited characters
     *
     * @param v - The value to validate
     * @returns True if valid, error message otherwise
     */
    (v: null | string) =>
      !["?", "\\", "#"].some((value) => v?.includes(value)) ||
      t("Prohibited characters are used"),
  ];

if (id.value) initLog();
else watch(id, initLog, { once });

watch(
  apiKey,
  (value) => {
    mistral = value ? createMistral({ apiKey: value }) : undefined;
  },
  { immediate },
);

/**
 * Sends a message to the AI assistant
 */
const send = async () => {
  if (mistral && log && message.value) {
    const content = [{ text: message.value, type: "text" }],
      { messages, system } = log.value;
    if (tab.value === "vue" && vueRef.value) {
      const text = ((await vueRef.value.getSelection()) ?? "") as string;
      if (text)
        content.unshift({ text: `\`\`\`vue\n${text}\n\`\`\``, type: "text" });
    }
    if (tab.value === "jsonld" && jsonldRef.value) {
      const text = ((await jsonldRef.value.getSelection()) ?? "") as string;
      if (text)
        content.unshift({ text: `\`\`\`json\n${text}\n\`\`\``, type: "text" });
    }
    messages.unshift({ content, role: "user" });
    message.value = "";
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
