<template lang="pug">
q-card(v-if="the", flat)
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
</template>

<script setup lang="ts">
import { sharedStore } from "@vuebro/shared";
import { mainStore } from "stores/main";
import { useI18n } from "vue-i18n";

const kvNodes = $toRef(sharedStore, "kvNodes"),
  selected = $toRef(mainStore, "selected"),
  the = $computed(() => kvNodes[selected]),
  { t } = useI18n();
</script>
