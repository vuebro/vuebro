<template lang="pug">
.row.q-col-gutter-xs
  .col-xs-12.col-sm-6.col-md-4.col-lg-3.col-xl-2(
    v-for="(image, i) in images",
    :key="i"
  )
    q-card(bordered, flat)
      q-card-section(horizontal)
        q-img.col(
          fit="cover",
          :ratio="16 / 9",
          :src="urls.get(image.url ?? '')"
        )
          .absolute-bottom
            q-input(v-model="image.alt", dark, dense)
        q-card-actions.q-px-md.justify-around(vertical)
          q-btn(
            :disable="!image.url",
            flat,
            icon="content_paste",
            round,
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

import { sharedStore } from "@vuebro/shared";
import { useFileDialog } from "@vueuse/core";
import mimes from "assets/mimes.json";
import { consola } from "consola/browser";
import { parse } from "path-browserify";
import { useQuasar } from "quasar";
import {
  accept,
  capture,
  immediate,
  multiple,
  persistent,
  reset,
} from "stores/defaults";
import { ioStore } from "stores/io";
import { mainStore } from "stores/main";
import { watch, watchEffect } from "vue";
import { useI18n } from "vue-i18n";

let images = $ref([] as TPage["images"]),
  index = 0;

const $q = useQuasar(),
  kvNodes = $toRef(sharedStore, "kvNodes"),
  selected = $toRef(mainStore, "selected"),
  { getObjectBlob, putObject } = ioStore,
  { onChange, open } = useFileDialog({
    accept,
    capture,
    multiple,
    reset,
  }),
  { t } = useI18n(),
  { urls } = mainStore;

const add = (i: number) => {
    const alt = "",
      url = "";
    images.splice(i + 1, 0, { alt, url });
  },
  copy = async (i: number) => {
    if (images[i]?.url) {
      await navigator.clipboard.writeText(images[i].url);
      $q.notify({ message: t("The link has been copied to clipboard") });
    }
  },
  left = (i: number) => {
    if (i) {
      const prev = images[i - 1];
      if (images[i] && prev) [images[i - 1], images[i]] = [images[i], prev];
    }
  },
  remove = (i: number) => {
    $q.dialog({
      cancel: true,
      message: t("Do you really want to delete?"),
      persistent,
      title: t("Confirm"),
    }).onOk(() => {
      images.splice(i, 1);
    });
  },
  right = (i: number) => {
    if (i < images.length - 1) {
      const next = images[i + 1];
      if (images[i] && next) [images[i], images[i + 1]] = [next, images[i]];
    }
  },
  upload = (i: number) => {
    index = i;
    open();
  };

watchEffect(() => {
  if (!images.length) add(-1);
  if (kvNodes[selected]) {
    kvNodes[selected].images = images
      .filter(({ url }) => url)
      .map(({ alt = "", url = "" }) => ({ alt, url }));
    kvNodes[selected].images
      .filter(({ url = "" }) => !urls.has(url))
      .forEach(({ url = "" }) => {
        (async () => {
          urls.set(url, URL.createObjectURL(await getObjectBlob(url)));
        })().catch(consola.error);
      });
  }
});

watch(
  () => kvNodes[selected],
  (value) => {
    if (!value?.images.length) {
      images.length = 0;
      add(-1);
    } else
      images = value.images.map(({ alt = "", url = "" }) => ({
        alt,
        url,
      }));
  },
  { immediate },
);

onChange((files) => {
  const image = images[index];
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
