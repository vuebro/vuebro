<template lang="pug">
Milkdown
</template>

<script setup lang="ts">
import { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/utils";
import { Milkdown, useEditor } from "@milkdown/vue";
import * as monaco from "monaco-editor";
import { useQuasar } from "quasar";
import { ioStore } from "stores/io";
import { onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";

const { model } = defineProps<{
  model: Promise<monaco.editor.ITextModel>;
}>();

let md = await model;

const $q = useQuasar(),
  urls = new Map(),
  { getObjectBlob, headObject, putObject } = ioStore,
  { t } = useI18n();

const { get } = useEditor((root) => {
  const crepe = new Crepe({
    defaultValue: md.getValue(),
    featureConfigs: {
      [Crepe.Feature.ImageBlock]: {
        onUpload: async (file) => {
          const { name, type } = file;
          const filePath = `uploads/${name}`;
          try {
            await headObject(filePath);
            await new Promise((resolve, reject) => {
              $q.dialog({
                cancel: true,
                message: t(
                  "The file is already exist, do you want to replace it?",
                ),
                persistent: true,
                title: t("Confirm"),
              })
                .onOk(() => {
                  reject(new Error());
                })
                .onCancel(() => {
                  resolve(undefined);
                });
            });
            urls.set(
              filePath,
              URL.createObjectURL(await getObjectBlob(filePath)),
            );
          } catch {
            void putObject(
              filePath,
              new Uint8Array(await file.arrayBuffer()),
              type,
            );
            urls.set(filePath, URL.createObjectURL(file));
          }
          return filePath;
        },
        proxyDomURL: async (url: string) => {
          if (!urls.has(url) && !/^(?:[a-z]+:)?\/\//i.test(url)) {
            const image = await getObjectBlob(url);
            if (image.size) urls.set(url, URL.createObjectURL(image));
          }
          return urls.get(url) ?? url;
        },
      },
    },
    root,
  });
  crepe.on((listener) => {
    listener.markdownUpdated((ctx, markdown) => {
      md.setValue(markdown);
    });
  });
  return crepe;
});

const clearUrls = () => {
  [...urls.values()].forEach((url) => {
    URL.revokeObjectURL(url);
  });
  urls.clear();
};

watch(
  () => model,
  async () => {
    md = await model;
    clearUrls();
    get()?.action(replaceAll(md.getValue()));
  },
);

onUnmounted(clearUrls);
</script>
