<template lang="pug">
q-dialog(ref="dialogRef", full-width, full-height, @hide="onDialogHide")
  q-card.q-dialog-plugin.column
    q-card-section.q-dialog__title {{ t("News") }}
    q-card-section.q-dialog__message JSON Feed: feed.json, ATOM: feed.xml, RSS: feed-rss.xml
    q-card-section.q-dialog-plugin__form.col.q-px-md(horizontal)
      q-form.w-full(ref="form")
        q-table.h-full.w-full(
          v-model:selected="selected",
          :rows,
          row-key="id",
          selection="single",
          :filter,
          grid,
          card-container-class="scroll",
          :rows-per-page-options="[4, 8, 12, 16, 20, 24, 28, 0]"
        )
          template(#top-left)
            q-btn-group(outline)
              q-btn(
                color="primary",
                icon="add",
                outline,
                @click="rows.unshift({ attachments: [{ mime_type: '', url: '' }], content_html: '', date_published: new Date().toISOString(), id: uid(), title: '', url: '' })"
              )
              q-btn(
                color="primary",
                icon="remove",
                outline,
                @click="removeRow"
              )
          template(#top-right)
            q-input(
              v-model="filter",
              borderless,
              debounce="300",
              placeholder="Search"
            )
              template(#append)
                q-icon(name="search")
          template(#item="props")
            .q-table__grid-item.col-xs-12.col-sm-6.col-md-4.col-lg-3(
              :class="{ 'q-table__grid-item--selected': props.selected }"
            )
              .q-table__grid-item-card.q-table__card.q-table--flat.q-table--bordered
                .q-table__grid-item-row
                  q-input(
                    v-model="props.row.title",
                    label="Title",
                    lazy-rules,
                    :rules="[(val) => !!val || t('Item is required')]"
                  )
                    template(#prepend)
                      q-checkbox(v-model="props.selected")
                .q-table__grid-item-row
                  q-input(
                    v-model="props.row.attachments[0].url",
                    filled,
                    label="Image",
                    type="url"
                  )
                    template(#append)
                      q-icon.cursor-pointer(
                        v-if="domain",
                        name="image",
                        @click="add(props.row)"
                      )
                .q-table__grid-item-row
                  q-input(
                    v-model="props.row.url",
                    filled,
                    label="Url",
                    type="url"
                  )
                    template(#append)
                      q-icon.cursor-pointer(
                        v-if="domain",
                        name="link",
                        @click="clickLink(props.row)"
                      )
                .q-table__grid-item-row
                  q-editor(
                    v-model="props.row.content_html",
                    placeholder="Content Html"
                  )
    q-card-actions(align="right")
      q-btn(
        color="primary",
        :label="t('Cancel')",
        flat,
        @click="onDialogCancel"
      )
      q-btn(color="primary", label="Ok", flat, @click="clickOk")
</template>

<script setup lang="ts">
import type { TFeed } from "@vuebro/shared";
import type { QForm } from "quasar";

import { useFileDialog } from "@vueuse/core";
import mimes from "assets/mimes.json";
import VLinkDialog from "components/dialogs/VLinkDialog.vue";
import { consola } from "consola/browser";
import { parse } from "path-browserify";
import { uid, useDialogPluginComponent, useQuasar } from "quasar";
import { accept, capture, multiple, persistent, reset } from "stores/defaults";
import { ioStore } from "stores/io";
import { mainStore } from "stores/main";
import { ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

const { feed } = defineProps<{ feed: TFeed }>();
const form = $(useTemplateRef<QForm>("form"));
const $q = useQuasar(),
  domain = $toRef(mainStore, "domain"),
  filter = ref(""),
  { dialogRef, onDialogCancel, onDialogHide, onDialogOK } =
    useDialogPluginComponent(),
  { items } = feed,
  { onChange, open } = useFileDialog({
    accept,
    capture,
    multiple,
    reset,
  }),
  { putObject } = ioStore,
  { t } = useI18n();

let row: null | TFeed["items"][0] = null,
  rows = $ref(
    items
      .map((item) => {
        item.url ||= "";
        if (!item.attachments.length)
          item.attachments.push({
            mime_type: "",
            url: "",
          });
        return item;
      })
      .reverse(),
  ),
  selected = $ref<TFeed["items"]>([]);

/**
 * Opens a file dialog to add an image attachment to the specified feed item
 *
 * @param value - The feed item to add an image to
 */
const add = (value: TFeed["items"][0]) => {
    row = value;
    open();
  },
  /**
   * Opens a dialog to select an internal link for the given feed item
   *
   * @param feed - The feed item to add a link to
   */
  clickLink = (feed: TFeed["items"][0]) => {
    $q.dialog({
      component: VLinkDialog,
      componentProps: {
        message: t("Select a page to insert the corresponding link"),
        persistent,
        title: t("Internal Links"),
      },
    }).onOk((value: string) => {
      feed.url = `https://${domain}${value}`;
    });
  },
  /**
   * Validates the form and closes the dialog with the feed items if valid
   */
  clickOk = async () => {
    if (await form?.validate()) onDialogOK(rows);
    else
      $q.notify({
        message: t("Title must be not empty"),
      });
  },
  /**
   * Removes the selected row after confirming with the user
   */
  removeRow = () => {
    if (selected.length)
      $q.dialog({
        cancel: true,
        message: t("Do you really want to delete?"),
        persistent: true,
        title: t("Confirm"),
      }).onOk(() => {
        const set = new Set(selected);
        rows = rows.filter((x) => !set.has(x));
        selected = [];
      });
  };

onChange((files) => {
  if (files) {
    const [file] = files;
    if (file && row) {
      const { name, type } = file;
      if (mimes.includes(type)) {
        const fileName = parse(name),
          filePath = `images/${fileName.name}.${Math.random().toString(36).slice(2)}${fileName.ext}`;
        (async () => {
          await putObject(
            filePath,
            new Uint8Array(await file.arrayBuffer()),
            type,
          );
        })().catch(consola.error);
        if (row.attachments[0])
          row.attachments[0].url = `https://${domain}/${filePath}`;
      } else
        $q.notify({
          message: t(
            "The graphic file type is not suitable for use on the web",
          ),
        });
    }
  }
});

defineEmits(useDialogPluginComponent.emits);
</script>
