import type { TPage } from "@vuebro/shared";

import mdc from "@shikijs/langs/mdc";
import vue from "@shikijs/langs/vue";
import lightTheme from "@shikijs/themes/github-light-default";
import darkTheme from "@shikijs/themes/nord";
import { InferSeoMetaPlugin } from "@unhead/addons";
import { createHead, renderSSRHead } from "@unhead/vue/server";
import { sharedStore } from "@vuebro/shared";
import { useFetch } from "@vueuse/core";
import { consola } from "consola/browser";
import { parse } from "hexo-front-matter";
import { editor, Uri } from "monaco-editor";
import { acceptHMRUpdate, defineStore } from "pinia";
import { debounce } from "quasar";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import options from "shiki/wasm";
import { cache, second } from "stores/defaults";
import { ioStore } from "stores/io";
import {
  AliasSortingPlugin,
  CanonicalPlugin,
  TemplateParamsPlugin,
} from "unhead/plugins";
import { ref, toRefs } from "vue";

export type TAppPage = TPage & {
  contenteditable: boolean;
};

const { kvNodes, nodes } = $(toRefs(sharedStore));

const oldPages: string[] = [],
  parseFrontmatter = (id: string) => {
    const model = editor.getModel(Uri.parse(`file:///${id}.md`));
    if (model && kvNodes[id])
      try {
        const frontmatter = parse(model.getValue());
        delete frontmatter._content;
        if (
          JSON.stringify(kvNodes[id].frontmatter) !==
          JSON.stringify(frontmatter)
        )
          kvNodes[id].frontmatter = frontmatter;
      } catch (error) {
        const { message } = error as Error;
        if (JSON.stringify(kvNodes[id].frontmatter) !== JSON.stringify({}))
          kvNodes[id].frontmatter = {};
        return message;
      }
    return "";
  },
  { data: body } = useFetch(`runtime/index.html`).text(),
  { data: manifest } = useFetch("runtime/.vite/manifest.json").json<
    Record<string, Record<string, string>>
  >(),
  { deleteObject, getObjectText, putObject, removeEmptyDirectories } = ioStore;

export const highlighter = await createHighlighterCore({
    engine: createOnigurumaEngine(options),
    langs: [vue, mdc],
    themes: [lightTheme, darkTheme],
  }),
  useMainStore = defineStore("main", () => {
    const domain = ref(""),
      leftDrawer = ref(false),
      message = ref(""),
      rightDrawer = ref(false),
      selected = ref("");

    const getModel = async (id: string) => {
        const uri = Uri.parse(`file:///${id}.md`);
        let model = editor.getModel(uri);
        const putObjectDebounced = debounce(() => {
          if (model)
            void putObject(
              `docs/${id}.md`,
              model.getValue(),
              "text/markdown",
            ).catch(consola.error);
        }, second);
        if (!model) {
          const value = await getObjectText(`docs/${id}.md`, cache);
          model = editor.createModel(
            value ||
              `---
title: Title
meta:
  - name: description
    content: Description
attrs:
  class:
    - prose
    - max-w-none
joint: true
hidden: false
---
`,
            "markdown",
            uri,
          );
          model.onDidChangeContent(() => {
            message.value = parseFrontmatter(id);
            putObjectDebounced();
          });
          message.value = parseFrontmatter(id);
          if (!value) putObjectDebounced();
        }
        return model;
      },
      putPages = async () => {
        const promises: Promise<void>[] = [];
        oldPages.forEach((url) => {
          if (!(nodes as TAppPage[]).find(({ path }) => path === url))
            promises.push(
              deleteObject(url ? `${url}/index.html` : "index.html"),
            );
        });
        await Promise.allSettled(promises);
        await removeEmptyDirectories();
        oldPages.length = 0;
        (nodes as TAppPage[]).forEach(({ branch, frontmatter, path }) => {
          if (path !== undefined) {
            oldPages.push(path);
            const vueHeadClient = createHead({
              plugins: [
                TemplateParamsPlugin,
                AliasSortingPlugin,
                ...(domain.value
                  ? [
                      CanonicalPlugin({
                        canonicalHost: `https://${domain.value}`,
                      }),
                    ]
                  : []),
                InferSeoMetaPlugin(),
              ],
            });
            if (nodes[0]?.frontmatter !== frontmatter)
              vueHeadClient.push(nodes[0]?.frontmatter);
            vueHeadClient.push({
              ...frontmatter,
              base: {
                href:
                  Array(branch.length - 1)
                    .fill("..")
                    .join("/") || "./",
              },
            });
            void (async () => {
              if (body.value)
                try {
                  const { headTags } = await renderSSRHead(vueHeadClient);
                  await putObject(
                    path ? `${path}/index.html` : "index.html",
                    body.value.replace(
                      "<head>",
                      `<head>
${headTags}
`,
                    ),
                    "text/html",
                  );
                } catch (error) {
                  const { message } = error as Error;
                  consola.error(message);
                }
            })();
          }
        });
      },
      putSitemap = async () => {
        await putObject(
          "sitemap.txt",
          (nodes as TPage[])
            .map(({ frontmatter: { hidden }, to }) =>
              domain.value && to && !hidden
                ? `https://${domain.value}${to === "/" ? "" : encodeURI(to)}`
                : undefined,
            )
            .filter(Boolean)
            .join("\n"),
          "text/plain",
        );
      };

    return {
      body,
      domain,
      getModel,
      leftDrawer,
      manifest,
      message,
      putPages,
      putSitemap,
      rightDrawer,
      selected,
    };
  });

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMainStore, import.meta.hot));
}
