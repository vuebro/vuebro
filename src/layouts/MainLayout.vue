<template lang="pug">
q-layout(view="hHh LpR lff")
  q-header
    q-toolbar
      q-btn(
        :class="{ invisible: !bucket }",
        dense,
        flat,
        icon="menu",
        round,
        @click="leftDrawer = !leftDrawer"
      )
      q-toolbar-title
        q-avatar(icon="img:favicon.svg", size="xl")
        | VueBro
      q-toggle(
        v-model="$q.dark.isActive",
        checked-icon="dark_mode",
        unchecked-icon="light_mode"
      )
      q-chip.q-mr-md(
        v-if="bucket",
        icon="language",
        :label="bucket",
        :ripple="false"
      )
      q-separator(v-if="bucket", dark, vertical)
      v-main-menu(v-if="bucket")
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
import { storeToRefs } from "pinia";
import { useQuasar } from "quasar";
import { ioStore } from "stores/io";
import { useMainStore } from "stores/main";
import { toRef, watch } from "vue";

const $q = useQuasar(),
  bucket = toRef(ioStore, "bucket"),
  mainStore = useMainStore(),
  { leftDrawer, rightDrawer } = storeToRefs(mainStore);

watch(
  () => $q.dark.isActive,
  (value) => {
    $q.dark.set(value);
  },
);
</script>
