<template lang="pug">
q-dialog(ref="dialogRef", full-height, full-width, @hide="onDialogHide")
  q-card.q-dialog-plugin.column
    q-card-section.q-dialog__title Import Map
    q-card-section.q-dialog__message {{ t("The value is a module specifier map, which provides the mappings between module specifier text that might appear in an import statement or import() operator, and the text that will replace it when the specifier is resolved") }}
    q-card-section.q-dialog-plugin__form.col(horizontal)
      q-table.w-full(
        v-model:selected="selected",
        :columns,
        dense,
        :filter,
        flat,
        hide-bottom,
        row-key="id",
        :rows,
        :rows-per-page-options="[0]",
        selection="single",
        separator="none"
      )
        template(#top-left)
          q-btn-group(outline)
            q-btn(
              color="primary",
              icon="add",
              outline,
              @click="rows.push({ id: uid(), name: '', path: '' })"
            )
            q-btn(color="primary", icon="remove", outline, @click="removeRow")
        template(#top-right)
          q-input(
            v-model="filter",
            borderless,
            debounce="300",
            placeholder="Search"
          )
            template(#append)
              q-icon(name="search")
        template(#body-selection="props")
          q-checkbox(
            v-model="props.selected",
            dense,
            :disable="Object.keys(staticEntries).includes(props.row.name)"
          )
        template(#body-cell="props")
          q-td(:auto-width="props.col.name === 'name'", :props)
            q-input.min-w-max(
              v-model.trim="props.row[props.col.name]",
              :autofocus="props.col.name === 'name'",
              dense,
              :disable="Object.keys(staticEntries).includes(props.row.name)"
            )
    q-card-actions(align="right")
      q-btn(
        color="primary",
        flat,
        :label="t('Cancel')",
        @click="onDialogCancel"
      )
      q-btn(
        color="primary",
        flat,
        label="Ok",
        @click="onDialogOK(Object.fromEntries(rows.filter(({ name, path }) => path && name).map(({ name, path }) => [name, path])))"
      )
</template>
<script setup lang="ts">
import type { QTableProps } from "quasar";

import json from "assets/importmap.json";
import { uid, useDialogPluginComponent, useQuasar } from "quasar";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const { importmap, staticEntries } = defineProps<{
  importmap: { imports: Record<string, string> };
  staticEntries: Record<string, string>;
}>();

const $q = useQuasar(),
  columns = json as QTableProps["columns"],
  filter = ref(""),
  selected = $ref<Record<string, string>[]>([]),
  { dialogRef, onDialogCancel, onDialogHide, onDialogOK } =
    useDialogPluginComponent(),
  { imports } = importmap,
  { t } = useI18n();

let rows = $ref(
  Object.entries({ ...imports, ...staticEntries }).map(
    ([name = "", path = ""]) => ({
      id: uid(),
      name,
      path,
    }),
  ),
);

const removeRow = () => {
  if (selected.length)
    $q.dialog({
      cancel: true,
      message: t("Do you really want to delete?"),
      persistent: true,
      title: t("Confirm"),
    }).onOk(() => {
      const set = new Set(selected);
      rows = rows.filter((x) => !set.has(x));
    });
};

defineEmits(useDialogPluginComponent.emits);
</script>
