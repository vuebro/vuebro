<template lang="pug">
q-drawer(
  v-model="rightDrawer",
  behavior="desktop",
  overlay,
  side="right",
  :width="rightDrawerWidth"
)
  .column.fit.no-wrap(v-if="apiKey")
    v-ai-chat
  .column.justify-center.text-center.full-height.q-mx-sm.items-center(v-else)
    q-btn(color="primary", label="AI key", push, @click="clickAI")
    .q-mt-md {{ t("You need an AI key to use this feature") }}
  q-separator.absolute-left(
    v-touch-pan.prevent.mouse.horizontal="resizeRightDrawer",
    :class="{ 'cursor-ew-resize': $q.screen.gt.sm }",
    vertical
  )
q-drawer(
  v-model="leftDrawer",
  show-if-above,
  side="left",
  :width="leftDrawerWidth"
)
  .column.fit.no-wrap(v-if="tree && the")
    v-interactive-tree
  q-separator.absolute-right(
    v-touch-pan.prevent.mouse.horizontal="resizeLeftDrawer",
    :class="{ 'cursor-ew-resize': $q.screen.gt.sm }",
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
        v-monaco-editor
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
import { computed, ref, toRefs, watchEffect } from "vue";
import { useI18n } from "vue-i18n";

/* -------------------------------------------------------------------------- */

const $q = useQuasar(),
  apiKey = useStorage("apiKey", ""),
  mainStore = useMainStore(),
  tab = ref("wysiwyg");

/* -------------------------------------------------------------------------- */

const { kvNodes, nodes, tree } = toRefs(sharedStore),
  { leftDrawer, rightDrawer } = storeToRefs(mainStore),
  { selected } = storeToRefs(mainStore),
  { t } = useI18n(),
  { width } = useWindowSize();

/* -------------------------------------------------------------------------- */

let initialLeftDrawerWidth = 300,
  initialRightDrawerWidth = width.value / 2;

/* -------------------------------------------------------------------------- */

const leftDrawerWidth = ref(initialLeftDrawerWidth),
  rightDrawerWidth = ref(initialRightDrawerWidth);

/* -------------------------------------------------------------------------- */

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
    if ($q.screen.gt.sm) {
      if (isFirst) initialLeftDrawerWidth = leftDrawerWidth.value;
      if (x) {
        const drawerWidth = initialLeftDrawerWidth + x;
        if (drawerWidth > 130 && drawerWidth < width.value / 3)
          leftDrawerWidth.value = drawerWidth;
      }
    }
  },
  resizeRightDrawer: TouchPanValue = ({ isFirst, offset: { x } = {} }) => {
    if ($q.screen.gt.sm) {
      if (isFirst) initialRightDrawerWidth = rightDrawerWidth.value;
      if (x) {
        const drawerWidth = initialRightDrawerWidth - x;
        if (drawerWidth > 130 && drawerWidth < width.value / 2)
          rightDrawerWidth.value = drawerWidth;
      }
    }
  },
  the = computed(
    () =>
      (kvNodes.value[selected.value] ?? nodes.value[0]) as TAppPage | undefined,
  );

/* -------------------------------------------------------------------------- */

watchEffect(() => {
  if (
    leftDrawer.value &&
    $q.screen.gt.sm &&
    leftDrawerWidth.value > width.value / 3
  )
    leftDrawerWidth.value = width.value / 3;
  else if ($q.screen.lt.sm) leftDrawerWidth.value = (3 * width.value) / 4;
  if (
    rightDrawer.value &&
    $q.screen.gt.md &&
    rightDrawerWidth.value > width.value / 2
  )
    rightDrawerWidth.value = width.value / 2;
  else if ($q.screen.lt.md) rightDrawerWidth.value = width.value;
});

/* -------------------------------------------------------------------------- */

rightDrawer.value = false;
</script>

<style scoped>
.q-textarea :deep(.q-field__control) {
  height: 100% !important;
}
.cursor-ew-resize {
  cursor: ew-resize;
}
</style>
