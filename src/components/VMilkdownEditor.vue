<template lang="pug">
Milkdown
</template>

<script setup lang="ts">
import { Crepe } from "@milkdown/crepe";
import lightTheme from "@milkdown/crepe/theme/frame.css?inline";
import darkTheme from "@milkdown/crepe/theme/nord-dark.css?inline";
import { htmlAttr, htmlSchema } from "@milkdown/kit/preset/commonmark";
import { replaceAll } from "@milkdown/utils";
import { Milkdown, useEditor } from "@milkdown/vue";
import { useStyleTag } from "@vueuse/core";
import { split } from "hexo-front-matter";
import { useQuasar } from "quasar";
import { immediate } from "stores/defaults";
import { ioStore } from "stores/io";
import { highlighter, mainStore } from "stores/main";
import { onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";

const selected = $toRef(mainStore, "selected"),
  { getModel } = mainStore;

let front = "",
  model = await getModel(selected);

const urls = new Map(),
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
    const value = model.getValue(),
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
            lang: "vue",
            themes: {
              dark: "nord",
              light: "github-light-default",
            },
          });
          div.classList = "rounded-borders q-card--bordered";
          return [
            "span",
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
  { css } = useStyleTag($q.dark.isActive ? darkTheme : lightTheme),
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
        model.setValue(
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

watch($$(selected), async (value) => {
  model = await getModel(value);
  clearUrls();
  get()?.action(replaceAll(getValue(), true));
});

watch(
  () => $q.dark.isActive,
  (value) => {
    css.value = value ? darkTheme : lightTheme;
  },
  { immediate },
);

onUnmounted(clearUrls);
</script>

<style scoped>
:deep(.milkdown) .editor {
  padding-top: 0;
  padding-bottom: 0;
}
</style>
