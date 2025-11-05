<template lang="pug">
.row.q-col-gutter-xs
  .col-xs-12.col-sm-6.col-md-4.col-lg-3.col-xl-2(
    v-for="(image, i) in images",
    :key="i"
  )
    q-card(bordered, flat)
      q-card-section(horizontal)
        q-img.col(
          :ratio="16 / 9",
          :src="urls.get(image.url ?? '')",
          fit="cover"
        )
          .absolute-bottom
            q-input(v-model="image.alt", dark, dense)
        q-card-actions.q-px-md.justify-around(vertical)
          q-btn(
            flat,
            icon="content_paste",
            round,
            :disable="!image.url",
            @click="copy(i)"
          )
            q-tooltip.bg-primary(
              v-if="image.url",
              anchor="center left",
              self="center right"
            ) {{ t("Copy Link") }}
          q-btn(flat, icon="add", round, @click="add(i)")
            q-tooltip.bg-primary(anchor="center left", self="center right") {{ t("Add Image") }}
          q-btn(flat, icon="remove", round, @click="remove(i)")
            q-tooltip.bg-primary(anchor="center left", self="center right") {{ t("Remove Image") }}
          q-btn(flat, icon="arrow_left", round, @click="left(i)")
            q-tooltip.bg-primary(anchor="center left", self="center right") {{ t("Image Left") }}
          q-btn(flat, icon="arrow_right", round, @click="right(i)")
            q-tooltip.bg-primary(anchor="center left", self="center right") {{ t("Image Right") }}
          q-btn(flat, icon="upload", round, @click="upload(i)")
            q-tooltip.bg-primary(anchor="center left", self="center right") {{ t("Upload Image") }}
</template>

<script setup lang="ts">
import type { TPage } from "@vuebro/shared";

import { useFileDialog } from "@vueuse/core";
import mimes from "assets/mimes.json";
import { consola } from "consola/browser";
import { parse } from "path-browserify";
import { useQuasar } from "quasar";
import { the, urls } from "stores/app";
import {
  accept,
  capture,
  immediate,
  multiple,
  persistent,
  reset,
} from "stores/defaults";
import { getObjectBlob, putObject } from "stores/io";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

let index = 0;

const { onChange, open } = useFileDialog({
    accept,
    capture,
    multiple,
    reset,
  }),
  { t } = useI18n();

const $q = useQuasar(),
  images = ref([] as TPage["images"]);

/**
 * Adds a new image at the specified index
 *
 * @param i - The index where to add the new image (-1 to add at the end)
 */
const add = (i: number) => {
    const alt = "",
      url = "";
    images.value.splice(i + 1, 0, { alt, url });
  },
  /**
   * Copies the URL of the image at the specified index to clipboard
   *
   * @param i - The index of the image to copy
   */
  copy = async (i: number) => {
    if (images.value[i]?.url) {
      await navigator.clipboard.writeText(images.value[i].url);
      $q.notify({ message: t("The link has been copied to clipboard") });
    }
  },
  /**
   * Moves the image at the specified index to the left
   *
   * @param i - The index of the image to move left
   */
  left = (i: number) => {
    if (i) {
      const prev = images.value[i - 1];
      if (images.value[i] && prev)
        [images.value[i - 1], images.value[i]] = [images.value[i], prev];
    }
  },
  /**
   * Removes the image at the specified index after confirming with the user
   *
   * @param i - The index of the image to remove
   */
  remove = (i: number) => {
    $q.dialog({
      cancel: true,
      message: t("Do you really want to delete?"),
      persistent,
      title: t("Confirm"),
    }).onOk(() => {
      images.value.splice(i, 1);
    });
  },
  /**
   * Moves the image at the specified index to the right
   *
   * @param i - The index of the image to move right
   */
  right = (i: number) => {
    if (i < images.value.length - 1) {
      const next = images.value[i + 1];
      if (images.value[i] && next)
        [images.value[i], images.value[i + 1]] = [next, images.value[i]];
    }
  },
  /**
   * Opens the file upload dialog for the image at the specified index
   *
   * @param i - The index of the image to upload
   */
  upload = (i: number) => {
    index = i;
    open();
  };

watch(
  images,
  (value) => {
    if (!value.length) add(-1);
    if (the.value) {
      the.value.images = value
        .filter(({ url }) => url)
        .map(({ alt = "", url = "" }) => ({ alt, url }));
      the.value.images
        .filter(({ url = "" }) => !urls.has(url))
        .forEach(({ url = "" }) => {
          (async () => {
            urls.set(url, URL.createObjectURL(await getObjectBlob(url)));
          })().catch(consola.error);
        });
    }
  },
  { deep: true },
);

watch(
  the,
  (value) => {
    if (!value?.images.length) {
      images.value.length = 0;
      add(-1);
    } else
      images.value = value.images.map(({ alt = "", url = "" }) => ({
        alt,
        url,
      }));
  },
  { immediate },
);

onChange((files) => {
  const image = images.value[index];
  if (files && image) {
    const [file] = files;
    if (file) {
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
        urls.set(filePath, URL.createObjectURL(file));
        image.url = filePath;
      } else
        $q.notify({
          message: t(
            "The graphic file type is not suitable for use on the web",
          ),
        });
    }
  }
});
</script>
