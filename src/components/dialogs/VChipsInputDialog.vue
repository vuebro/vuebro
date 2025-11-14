<template lang="pug">
q-dialog(ref="dialogRef", @hide="onDialogHide")
  q-card.q-dialog-plugin
    q-card-section.q-dialog__title {{ title }}
    q-card-section.q-dialog__message {{ message }}
    q-card-section.q-dialog-plugin__form
      q-select(
        v-model="value",
        hide-dropdown-icon,
        multiple,
        new-value-mode="add",
        stack-label,
        use-chips,
        use-input,
        dense
      )
    q-card-actions(align="right")
      q-btn(
        color="primary",
        flat,
        :label="t('Cancel')",
        @click="onDialogCancel"
      )
      q-btn(color="primary", flat, label="OK", @click="onDialogOK(value)")
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import { useI18n } from "vue-i18n";

const { message, title } = defineProps<{
  message: string;
  title: string;
}>();

const { dialogRef, onDialogCancel, onDialogHide, onDialogOK } =
    useDialogPluginComponent(),
  { t } = useI18n();

const value = defineModel<string[]>("value");

defineEmits([...useDialogPluginComponent.emits]);
</script>
