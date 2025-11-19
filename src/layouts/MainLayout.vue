<template lang="pug">
q-layout(view="hHh Lpr lff")
  q-header
    q-toolbar
      q-toolbar-title
        q-avatar(icon="img:favicon.svg", size="xl")
        | VueBro
      q-chip.q-mr-md(
        v-if="bucket",
        icon="language",
        :label="bucket",
        :ripple="false"
      )
      q-separator(v-if="bucket", dark, vertical)
      v-main-menu
      q-btn(
        dense,
        flat,
        icon="more_vert",
        round,
        @click="rightDrawer = !rightDrawer"
      )
  q-page-container.window-height
    Suspense
      router-view
</template>

<script setup lang="ts">
import VMainMenu from "components/VMainMenu.vue";
import { ioStore } from "stores/io";
import { mainStore } from "stores/main";
import { toRef } from "vue";

const bucket = toRef(ioStore, "bucket"),
  rightDrawer = toRef(mainStore, "rightDrawer");
</script>
