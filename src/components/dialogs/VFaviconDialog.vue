<template lang="pug">
q-dialog(ref="dialogRef", @hide="onDialogHide")
  q-card
    q-card-section(horizontal)
      q-uploader.min-h-72(
        ref="uploader",
        accept="image/vnd.microsoft.icon",
        :factory,
        flat,
        label="Favicon",
        square
      )
    q-card-actions(align="right")
      q-btn(color="primary", flat, :label="t('Close')", @click="onDialogHide")
</template>

<script setup lang="ts">
import type { QUploader } from "quasar";

import { useDialogPluginComponent, useQuasar } from "quasar";
import { ioStore } from "stores/io";
import { useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

const uploader = $(useTemplateRef<QUploader>("uploader"));

const $q = useQuasar(),
  { dialogRef, onDialogHide } = useDialogPluginComponent(),
  { putObject } = ioStore,
  { t } = useI18n();

/**
 * Factory function to handle favicon uploads
 *
 * @param files - Array of files to upload
 * @returns - Always returns a rejected promise
 */
const factory = async (files: readonly File[]) => {
  const [file] = files;
  let message = t("Favicon uploaded successfully");
  try {
    if (file)
      await putObject(
        "favicon.ico",
        new Uint8Array(await file.arrayBuffer()),
        "image/vnd.microsoft.icon",
      );
    else throw new Error();
    uploader?.reset();
  } catch {
    message = t("Favicon upload failed");
  }
  $q.notify({ message });
  return Promise.reject(new Error());
};

defineEmits(useDialogPluginComponent.emits);
</script>
