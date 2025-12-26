<template lang="pug">
Milkdown
</template>

<script setup lang="ts">
import { Crepe } from "@milkdown/crepe";
import lightTheme from "@milkdown/crepe/theme/frame.css?inline";
import darkTheme from "@milkdown/crepe/theme/nord-dark.css?inline";
import { editorViewCtx, parserCtx, serializerCtx } from "@milkdown/kit/core";
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
  { selected } = $(storeToRefs(mainStore));

let front = "",
  model = await getModel(selected);

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

const copilotKey = new PluginKey("MilkdownCopilot");

const getHint = (ctx: Ctx) => {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const tr = state.tr;
  const { from } = tr.selection;
  const slice = tr.doc.slice(0, from);
  const serializer = ctx.get(serializerCtx);
  const doc = view.state.schema.topNodeType.createAndFill(
    undefined,
    slice.content,
  );
  if (!doc) return;
  const markdown = serializer(doc);
  void (async () => {
    const hint = await fetchAIHint(markdown);
    const tr = cloneTr(view.state.tr);
    view.dispatch(tr.setMeta(copilotKey, hint));
  })();
};

const applyHint = (ctx: Ctx) => {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const tr = state.tr;
  const { message } = copilotKey.getState(state);
  const parser = ctx.get(parserCtx);
  const slice = parser(message);
  const dom = DOMSerializer.fromSchema(state.schema).serializeFragment(
    slice.content,
  );
  const domParser = DOMParser.fromSchema(state.schema);
  view.dispatch(
    tr.setMeta(copilotKey, "").replaceSelection(domParser.parseSlice(dom)),
  );
};

const hideHint = (ctx: Ctx) => {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const tr = state.tr;
  view.dispatch(tr.setMeta(copilotKey, ""));
};

const copilotPlugin = $prose((ctx) => {
  return new Plugin({
    key: copilotKey,
    props: {
      decorations(state) {
        return copilotKey.getState(state).deco;
      },
      handleKeyDown(_view, event) {
        if (event.key === "Tab") {
          event.preventDefault();
          applyHint(ctx);
          return;
        }
        if (event.key === "Enter" || event.code === "Space") {
          getHint(ctx);
          return;
        }

        hideHint(ctx);
      },
    },
    state: {
      apply(tr, value, _prevState, state) {
        const message = tr.getMeta(copilotKey);
        if (typeof message !== "string") return value;
        if (message.length === 0) {
          return {
            deco: DecorationSet.empty,
            message: "",
          };
        }
        const { to } = tr.selection;
        const widget = Decoration.widget(to + 1, () => {
          const dom = document.createElement("pre");
          dom.className = "bg-slate-100 border-slate-400 text-gray-800";
          dom.innerHTML = message;
          return dom;
        });
        return {
          deco: DecorationSet.create(state.doc, [widget]),
          message,
        };
      },
      init() {
        return {
          deco: DecorationSet.empty,
          message: "",
        };
      },
    },
  });
});

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
    crepe.editor.use(htmlSchemaExtended).use(copilotPlugin);
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
