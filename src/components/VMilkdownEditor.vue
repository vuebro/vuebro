<template lang="pug">
Milkdown
</template>

<script setup lang="ts">
import type { EditorView } from "prosemirror-view";

import { Crepe } from "@milkdown/crepe";
import lightTheme from "@milkdown/crepe/theme/frame.css?inline";
import darkTheme from "@milkdown/crepe/theme/nord-dark.css?inline";
import { parserCtx, serializerCtx } from "@milkdown/kit/core";
import { Ctx } from "@milkdown/kit/ctx";
import { htmlAttr, htmlSchema } from "@milkdown/kit/preset/commonmark";
import { cloneTr } from "@milkdown/kit/prose";
import { DOMParser, DOMSerializer } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { replaceAll } from "@milkdown/utils";
import { Milkdown, useEditor } from "@milkdown/vue";
import { useStyleTag } from "@vueuse/core";
import { split } from "hexo-front-matter";
import { storeToRefs } from "pinia";
import { useQuasar } from "quasar";
import { immediate } from "stores/defaults";
import { ioStore } from "stores/io";
import { highlighter, useMainStore } from "stores/main";
import { onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";

const mainStore = useMainStore(),
  { getModel } = mainStore,
  { selected } = storeToRefs(mainStore);

let front = "",
  model = await getModel(selected.value);

const fetchAIHint = async (prompt: string) => {
  // const data: Record<string, string> = { prompt };
  // const response = await fetch("/api", {
  //   body: JSON.stringify(data),
  //   method: "POST",
  // });
  // const res = (await response.json()) as { hint: string };
  const res = { hint: prompt };
  return Promise.resolve(res.hint);
};

const key = new PluginKey("MilkdownCopilot");

const getHint = async ({ get }: Ctx, view: EditorView) => {
  const {
    dispatch,
    state: {
      schema: { topNodeType },
      tr: {
        doc,
        selection: { from },
      },
    },
  } = view;
  const { content } = doc.slice(0, from);
  const node = topNodeType.createAndFill(undefined, content);
  if (node) {
    const hint = await fetchAIHint(get(serializerCtx)(node));
    dispatch(cloneTr(view.state.tr).setMeta(key, hint));
  }
};

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
            if (!urls.has(url) && !URL.canParse(url)) {
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
    crepe.editor.use(htmlSchemaExtended).use(
      $prose(
        (ctx) =>
          new Plugin({
            key,
            props: {
              decorations: (state) => key.getState(state).deco,
              handleKeyDown(view, event) {
                switch (event.key) {
                  case "Enter":
                    void getHint(ctx, view);
                    break;
                  case "Tab": {
                    const { dispatch, state } = view;
                    const { schema, tr } = state;
                    const { message } = key.getState(state);
                    const { content } = ctx.get(parserCtx)(message);
                    event.preventDefault();
                    dispatch(
                      tr
                        .setMeta(key, "")
                        .replaceSelection(
                          DOMParser.fromSchema(schema).parseSlice(
                            DOMSerializer.fromSchema(schema).serializeFragment(
                              content,
                            ),
                          ),
                        ),
                    );
                    break;
                  }
                  default: {
                    const {
                      dispatch,
                      state: { tr },
                    } = view;
                    dispatch(tr.setMeta(key, ""));
                  }
                }
              },
              handleTextInput(view, _from, _to, text) {
                if (text === " ") void getHint(ctx, view);
              },
            },
            state: {
              apply(tr, value, _prevState, state) {
                const message = tr.getMeta(key),
                  {
                    selection: { to },
                  } = tr;
                return typeof message === "string"
                  ? {
                      deco: message.length
                        ? DecorationSet.create(state.doc, [
                            Decoration.widget(to + 1, () => {
                              const dom = document.createElement("pre");
                              dom.className =
                                "bg-slate-100 border-slate-400 text-gray-800";
                              dom.innerHTML = message;
                              return dom;
                            }),
                          ])
                        : DecorationSet.empty,
                      message,
                    }
                  : value;
              },
              init: () => ({
                deco: DecorationSet.empty,
                message: "",
              }),
            },
          }),
      ),
    );
    return crepe;
  });

watch(selected, async (value) => {
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
