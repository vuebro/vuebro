<template lang="pug">
Milkdown
</template>

<script setup lang="ts">
import type { editor } from "monaco-editor";

import { Crepe } from "@milkdown/crepe";
import { htmlAttr, htmlSchema } from "@milkdown/kit/preset/commonmark";
import { replaceAll } from "@milkdown/utils";
import { Milkdown, useEditor } from "@milkdown/vue";
import { split } from "hexo-front-matter";
import { useQuasar } from "quasar";
import { createHighlighter } from "shiki";
import { ioStore } from "stores/io";
import { onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";

const { model } = defineProps<{
  model: Promise<editor.ITextModel>;
}>();

let front = "",
  md = await model;

const highlighter = await createHighlighter({
    langs: ["html"],
    themes: ["vitesse-light", "vitesse-dark"],
  }),
  urls = new Map(),
  yaml = "---",
  { t } = useI18n();
const $q = useQuasar(),
  clearUrls = () => {
    [...urls.values()].forEach((url) => {
      URL.revokeObjectURL(url);
    });
    urls.clear();
  },
  getValue = () => {
    const value = md.getValue(),
      { content, data, prefixSeparator, separator } = split(value);
    if (data && separator === yaml && prefixSeparator) {
      front = data;
      return content;
    } else {
      front = "";
      return value;
    }
  },
  htmlSchemaExtended = htmlSchema.extendSchema((prev) => {
    return (ctx) => {
      const baseSchema = prev(ctx);
      return {
        ...baseSchema,
        toDOM: (node) => {
          const div = document.createElement("div");
          div.innerHTML = highlighter.codeToHtml(node.attrs.value, {
            lang: "html",
            theme: "vitesse-light",
          });
          div.classList = "rounded-borders q-card--bordered";
          return [
            "div",
            {
              ...ctx.get(htmlAttr.key)(node),
              "data-type": "html",
              "data-value": node.attrs.value,
            },
            div,
          ];
        },
      };
    };
  }),
  { getObjectBlob, headObject, putObject } = ioStore,
  { get } = useEditor((root) => {
    const crepe = new Crepe({
      defaultValue: getValue(),
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
        md.setValue(
          front
            ? `${yaml}
${front}
${yaml}

${markdown}`
            : markdown,
        );
      });
    });
    void crepe.editor.remove(htmlSchema);
    crepe.editor.use(htmlSchemaExtended);
    return crepe;
  });

watch(
  () => model,
  async () => {
    md = await model;
    clearUrls();
    get()?.action(replaceAll(getValue()));
  },
);

onUnmounted(() => {
  clearUrls();
  highlighter.dispose();
});
</script>

<style scoped>
:deep(.milkdown) .editor {
  padding-top: 0;
  padding-bottom: 0;
}
</style>
