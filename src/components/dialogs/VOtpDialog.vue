<template lang="pug">
q-dialog(ref="dialogRef", @hide="onDialogHide")
  q-card.q-dialog-plugin
    q-card-section.row.q-gutter-sm.justify-center
      q-input(
        v-for="i in length",
        :key="i",
        :ref="(el) => { updateFieldRef(el, i - 1); }",
        v-model="fieldValues[i - 1]",
        autofocus,
        :class="{ 'bg-negative': error }",
        input-class="text-center",
        mask="#",
        maxlength="1",
        outlined,
        style="width: 6ch",
        type="password",
        @blur="fields[selected]?.focus()",
        @click="selected = i - 1",
        @keydown.tab.prevent,
        @keyup.delete="focus(i - 2)",
        @keyup.left="focus(i - 2)",
        @keyup.right="focus(i)",
        @update:model-value="(ev) => { if (ev) focus(i); }"
      )
</template>

<script setup lang="ts">
import type { QInput } from "quasar";
import type { ComponentPublicInstance } from "vue";

import { AES } from "crypto-es";
import { useDialogPluginComponent } from "quasar";
import { computed, watch } from "vue";

const { model } = defineProps<{ model: string | undefined }>();

const fields = $ref<QInput[]>([]),
  fieldValues = $ref<number[]>([]),
  length = 4,
  payload = computed(() => fieldValues.filter(Boolean).join("")),
  { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

let error = $ref(false),
  selected = $ref(0);

const focus = (index: number) => {
    if (index >= 0 && index < length) selected = index;
  },
  updateFieldRef = (
    element: ComponentPublicInstance | Element | null,
    index: number,
  ) => {
    fields[index] = element as QInput;
  };

defineEmits(useDialogPluginComponent.emits);

watch(
  payload,
  (value) => {
    if (value.length === length) {
      if (model) error = !AES.decrypt(model, value).toString();
      if (!error) onDialogOK(value);
    } else error = false;
  },
  { deep: true },
);

watch($$(selected), (value) => {
  fields[value]?.select();
});
</script>
