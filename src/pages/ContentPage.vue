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
            default-opened,
            header-class="text-primary",
            icon="account_tree",
            :label="t('Content Tree')"
          )
            v-interactive-tree
          q-separator
          v-page-settings
          q-separator
          v-seo-settings
      q-tab-panel.column.no-padding.justify-center(name="ai")
        .column.fit.no-wrap(v-if="apiKey")
          v-ai-chat(:api-key)
        .self-center.text-center(v-else)
          q-btn(color="primary", label="AI key", unelevated, @click="clickAI")
          .q-mt-md {{ t("You need an AI key to use this feature") }}
  q-separator.bg-separator.absolute-left.-left-px.cursor-ew-resize(
    v-touch-pan.preserveCursor.prevent.mouse.horizontal="resizeDrawer",
    class="after:absolute after:top-1/2 after:-right-[5px] after:-left-[5px] after:h-[30px] after:-translate-y-1/2 after:rounded-[4px] after:bg-gray-400 after:pt-[3px] after:text-center after:content-['∷']",
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
        v-source-code(ref="vueRef", :api-key, :model="the.sfc", :technologies)
          template(#fallback)
            q-inner-loading(showing)
              q-spinner-hourglass
    q-tab-panel(name="jsonld")
      Suspense
        v-source-code(
          ref="jsonldRef",
          :api-key,
          :model="the.jsonld",
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
import type { TAppPage } from "stores/main";

import { sharedStore } from "@vuebro/shared";
import { useStorage } from "@vueuse/core";
import VAiChat from "components/VAiChat.vue";
import VImages from "components/VImages.vue";
import VInteractiveTree from "components/VInteractiveTree.vue";
import VPageSettings from "components/VPageSettings.vue";
import VSeoSettings from "components/VSeoSettings.vue";
import VWysiwyg from "components/VWysiwyg.vue";
import { useQuasar } from "quasar";
import VSourceCode from "src/components/VSourceCode.vue";
import { cancel, html, persistent } from "stores/defaults";
import { mainStore } from "stores/main";
import { computed, ref, toRefs, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

const { importmap, kvNodes, nodes, tree } = $(toRefs(sharedStore));
const { rightDrawer, selected } = $(toRefs(mainStore));
const jsonldRef = $(
  useTemplateRef<InstanceType<typeof VSourceCode>>("jsonldRef"),
);
const vueRef = $(useTemplateRef<InstanceType<typeof VSourceCode>>("vueRef"));

const $q = useQuasar(),
  drawerTab = ref("seo"),
  tab = $ref("wysiwyg"),
  technologies = computed(() => [
    "tailwindcss",
    ...Object.keys(importmap.imports).filter((value) => value !== "vue"),
  ]),
  the = $computed(
    () => (kvNodes[selected] ?? nodes[0]) as TAppPage | undefined,
  ),
  { t } = useI18n();

let apiKey = $(useStorage("apiKey", ""));
let initialDrawerWidth = 300,
  drawerWidth = $ref(initialDrawerWidth);

const clickAI = () => {
    $q.dialog({
      cancel,
      html,
      message: `${t("Get Mistral API Key")} at <a class="underline text-blue" href="https://console.mistral.ai/api-keys" target="_blank" rel="noreferrer">https://console.mistral.ai/api-keys</a>`,
      persistent,
      prompt: {
        hint: t("paste Mistral API Key only on a trusted computer"),
        model: apiKey,
        type: "password",
      },
      title: "Mistral API Key",
    }).onOk((data: string) => {
      apiKey = data;
    });
  },
  resizeDrawer = ({
    isFirst,
    offset: { x },
  }: {
    isFirst: boolean;
    offset: { x: number };
  }) => {
    if (isFirst) initialDrawerWidth = drawerWidth;
    const width = initialDrawerWidth - x;
    if (width > 300) drawerWidth = width;
  };
</script>
