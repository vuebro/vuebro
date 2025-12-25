<template lang="pug">
q-drawer(
  v-model="leftDrawer",
  show-if-above,
  side="left",
  :width="leftDrawerWidth"
)
  .column.fit.no-wrap(v-if="tree && the")
    v-interactive-tree
  q-separator.absolute-right.cursor-ew-resize(
    v-touch-pan.prevent.mouse.horizontal="resizeLeftDrawer",
    vertical
  )
q-drawer(
  v-model="rightDrawer",
  overlay,
  side="right",
  :width="rightDrawerWidth"
)
  .column.fit.no-wrap(v-if="apiKey")
    v-ai-chat
  .self-center.text-center(v-else)
    q-btn(color="primary", label="AI key", unelevated, @click="clickAI")
    .q-mt-md {{ t("You need an AI key to use this feature") }}
  q-separator.absolute-left.cursor-ew-resize(
    v-touch-pan.prevent.mouse.horizontal="resizeRightDrawer",
    vertical
  )
q-page.column.full-height(v-if="the")
  q-tabs(
    v-model="tab",
    active-color="primary",
    align="justify",
    dense,
    indicator-color="primary",
    narrow-indicator
  )
    q-tab(label="wysiwyg", name="wysiwyg")
    q-tab(label="markdown", name="md")
  q-tab-panels.full-width.col(v-if="selected", v-model="tab")
    q-tab-panel.q-px-none.milkdown(name="wysiwyg")
      Suspense
        milkdown-provider
          v-milkdown-editor.full-height.scroll
        template(#fallback)
          q-inner-loading(showing)
            q-spinner-hourglass
    q-tab-panel(name="md")
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
import type { TouchPanValue } from "quasar";
import type { TAppPage } from "stores/main";

import { MilkdownProvider } from "@milkdown/vue";
import { sharedStore } from "@vuebro/shared";
import { useStorage, useWindowSize } from "@vueuse/core";
import VAiChat from "components/VAiChat.vue";
import VInteractiveTree from "components/VInteractiveTree.vue";
import VMilkdownEditor from "components/VMilkdownEditor.vue";
import VMonacoEditor from "components/VMonacoEditor.vue";
import { storeToRefs } from "pinia";
import { useQuasar } from "quasar";
import { cancel, html, persistent } from "stores/defaults";
import { useMainStore } from "stores/main";
import { toRefs, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";

const sharedRefs = toRefs(sharedStore);
const $q = useQuasar(),
  mainStore = useMainStore(),
  monaco = $(useTemplateRef<InstanceType<typeof VMonacoEditor>>("monaco")),
  { t } = useI18n(),
  { width } = $(useWindowSize());

const { kvNodes, nodes, tree } = $(sharedRefs);
const { leftDrawer, rightDrawer } = storeToRefs(mainStore),
  { selected } = $(storeToRefs(mainStore));

rightDrawer.value = false;

const apiKey = useStorage("apiKey", ""),
  tab = $ref("wysiwyg"),
  the = $computed(
    () => (kvNodes[selected] ?? nodes[0]) as TAppPage | undefined,
  );

let initialLeftDrawerWidth = 300,
  initialRightDrawerWidth = 300,
  leftDrawerWidth = $ref(initialLeftDrawerWidth),
  rightDrawerWidth = $ref(initialRightDrawerWidth);

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
  resizeLeftDrawer: TouchPanValue = ({ isFirst, offset: { x } = {} }) => {
    if (isFirst) initialLeftDrawerWidth = leftDrawerWidth;
    if (x) {
      const drawerWidth = initialLeftDrawerWidth + x;
      if (drawerWidth > 130 && drawerWidth < width / 3)
        leftDrawerWidth = drawerWidth;
    }
  },
  resizeRightDrawer: TouchPanValue = ({ isFirst, offset: { x } = {} }) => {
    if (isFirst) initialRightDrawerWidth = rightDrawerWidth;
    if (x) {
      const drawerWidth = initialRightDrawerWidth - x;
      if (drawerWidth > 130 && drawerWidth < width / 2)
        rightDrawerWidth = drawerWidth;
    }
  };

watch($$(width), (value) => {
  if (leftDrawer.value && leftDrawerWidth > value / 3)
    leftDrawerWidth = value / 3;
  if (rightDrawer.value && rightDrawerWidth > value / 2)
    rightDrawerWidth = value / 2;
});
</script>

<style scoped>
.q-textarea :deep(.q-field__control) {
  height: 100% !important;
}
.cursor-ew-resize {
  cursor: ew-resize;
}
</style>
