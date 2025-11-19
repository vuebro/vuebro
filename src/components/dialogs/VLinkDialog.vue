<template lang="pug">
q-dialog(ref="dialogRef", full-height, @hide="onDialogHide")
  q-card.q-dialog-plugin.column
    q-card-section.q-dialog__title {{ title }}
    q-card-section.q-dialog__message {{ message }}
    q-card-section.q-dialog-plugin__form.scroll.col
      q-tree(
        v-model:selected="selected",
        :nodes="tree",
        default-expand-all,
        no-selection-unset,
        node-key="id",
        selected-color="primary"
      )
        template(#default-header="prop")
          .row.items-center(
            @dblclick="onDialogOK(kvNodes[selected ?? '']?.to)"
          )
            Icon.q-icon.q-tree__icon.q-mr-sm(
              :icon="prop.node.icon || 'mdi:web'"
            )
            div {{ prop.node.name }}
    q-card-actions(align="right")
      q-btn(
        color="primary",
        :label="t('Cancel')",
        flat,
        @click="onDialogCancel"
      )
      q-btn(
        color="primary",
        flat,
        label="Ok",
        @click="onDialogOK(kvNodes[selected ?? '']?.to)"
      )
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { sharedStore } from "@vuebro/shared";
import { useDialogPluginComponent } from "quasar";
import { useI18n } from "vue-i18n";

const { message, title } = defineProps<{
  message: string;
  title: string;
}>();

const kvNodes = $toRef(sharedStore, "kvNodes"),
  { dialogRef, onDialogCancel, onDialogHide, onDialogOK } =
    useDialogPluginComponent(),
  { tree } = sharedStore,
  { t } = useI18n();

const selected = $ref(tree[0]?.id);

defineEmits([...useDialogPluginComponent.emits]);
</script>
