<template lang="pug">
router-view
</template>

<script setup lang="ts">
import type { TFeed, TImportmap, TPage } from "@vuebro/shared";
import type { TAppPage } from "stores/main";

import { sharedStore } from "@vuebro/shared";
import { consola } from "consola/browser";
import { parse } from "hexo-front-matter";
import jsonfeedToAtom from "jsonfeed-to-atom";
import jsonfeedToRSS from "jsonfeed-to-rss";
import { editor, Uri } from "monaco-editor";
import { debounce } from "quasar";
import { cache, deep, second, writable } from "stores/defaults";
import { ioStore } from "stores/io";
import { mainStore } from "stores/main";
import { toRef, toRefs, watch, watchEffect } from "vue";
// eslint-disable-next-line import-x/no-unresolved
import "virtual:uno.css";

let domain = $toRef(mainStore, "domain"),
  tree = $toRef(sharedStore, "tree");

const { feed, importmap, kvNodes, nodes } = $(toRefs(sharedStore));
const { selected, staticEntries } = $(toRefs(mainStore));

const bucket = toRef(ioStore, "bucket"),
  prevImages: string[] = [],
  { deleteObject, getObjectText, headObject, putObject } = ioStore,
  { manifest, putPages, urls } = mainStore;

const getModel = async (
  id: string,
  ext: string,
  language: string,
  mime: string,
  init: string,
) => {
  const uri = Uri.parse(`file:///${id}.${ext}`);
  let model = editor.getModel(uri);
  const initObject = () => {
    if (model && id) {
      putObject(`docs/${id}.${ext}`, model.getValue(), mime).catch(
        consola.error,
      );
      if (kvNodes[id])
        try {
          const head = parse(model.getValue());
          console.log(head);
          delete head._content;
          if (JSON.stringify(kvNodes[id].head) !== JSON.stringify(head))
            kvNodes[id].head = head;
        } catch {
          if (JSON.stringify(kvNodes[id].head) !== JSON.stringify({}))
            kvNodes[id].head = {};
        }
    }
  };
  if (!model) {
    const value = await getObjectText(`docs/${id}.${ext}`, cache);
    model = editor.createModel(value || init, language, uri);
    model.onDidChangeContent(debounce(initObject, second));
    if (!value) initObject();
  }
  return model;
};

/* -------------------------------------------------------------------------- */
/*                            Вычисляемые параметры                           */
/* -------------------------------------------------------------------------- */

const contenteditable = { value: false, writable },
  sfc = {
    get(this: TAppPage) {
      return this.id
        ? getModel(this.id, "md", "markdown", "text/markdown", "")
        : undefined;
    },
  };

/* -------------------------------------------------------------------------- */
/*                             Функции смотрителей                            */
/* -------------------------------------------------------------------------- */

const clearImages = (
    value: TAppPage | undefined,
    oldValue: TAppPage | undefined,
  ) => {
    const images = value?.images.map(({ url = "" }) => url);
    if (images) {
      if (value?.id === oldValue?.id) {
        prevImages
          .filter((url) => !images.includes(url))
          .forEach((url) => {
            URL.revokeObjectURL(urls.get(url) ?? "");
            urls.delete(url);
            deleteObject(url).catch(consola.error);
          });
      }
      prevImages.length = 0;
      prevImages.push(...images);
    }
  },
  init = async (value: string) => {
    if (value) {
      const [getIndex, getFonts, getImportmap, getFeed, getCname, getManifest] =
        (
          await Promise.all(
            [
              "index.json",
              "fonts.json",
              "index.importmap",
              "feed.json",
              "CNAME",
              ".vite/manifest.json",
            ].map((file) => getObjectText(file, cache)),
          )
        ).map((value) => value || undefined);

      const [cname = ""] = getCname?.split("\n", 1) ?? [],
        [localManifest, serverManifest] = (
          [manifest, JSON.parse(getManifest ?? "{}")] as Record<
            string,
            Record<string, string[]> | undefined
          >[]
        ).map(
          (element) =>
            new Set(
              [
                ...Object.values(element).map(({ file } = {}) => file),
                ...(element["index.html"]?.css ?? []),
              ].filter(Boolean) as string[],
            ),
        ),
        files = ["robots.txt", "fonts.json"],
        { imports } = JSON.parse(getImportmap ?? "{}") as TImportmap,
        { items } = JSON.parse(getFeed ?? "{}") as TFeed;

      tree = JSON.parse(getIndex ?? "[{}]");
      sharedStore.fonts = JSON.parse(getFonts ?? "[]");
      importmap.imports = { ...imports, ...staticEntries };
      feed.items = items;
      domain = cname.trim();
      if (localManifest && serverManifest) {
        (
          await Promise.allSettled(files.map((file) => headObject(file, cache)))
        ).forEach(({ status }, index) => {
          if (status === "rejected" && files[index])
            localManifest.add(files[index]);
        });

        [...serverManifest]
          .filter((x) => !localManifest.has(x))
          .forEach((element) => {
            deleteObject(element).catch(consola.error);
          });

        [...localManifest.add(".vite/manifest.json")]
          .filter((x) => !serverManifest.has(x))
          .forEach((element) => {
            (async () => {
              const body = await (await fetch(`runtime/${element}`)).blob();
              putObject(
                element,
                new Uint8Array(await body.arrayBuffer()),
                body.type,
              ).catch(consola.error);
            })().catch(consola.error);
          });

        putPages().catch(consola.error);
      }
    } else {
      tree.length = 0;

      editor.getModels().forEach((model) => {
        model.dispose();
      });

      urls.forEach((url, key) => {
        URL.revokeObjectURL(url);
        urls.delete(key);
      });
    }
  };

/* -------------------------------------------------------------------------- */
/*                                 Смотрители                                 */
/* -------------------------------------------------------------------------- */

watch(() => kvNodes[selected] as TAppPage | undefined, clearImages, { deep });

watchEffect(() => {
  nodes.forEach((object) => {
    Object.defineProperties(object, {
      contenteditable,
      sfc,
    });
  });
});

watch(bucket, init);

watch(
  [$$(nodes), $$(feed), $$(domain)],
  debounce((arr) => {
    const [page, value, tld] = arr as [TPage[], TFeed, string],
      [{ title } = {}] = page,
      { items } = value;
    const jsonfeed = {
      items,
      title,
      version: "https://jsonfeed.org/version/1",
    } as TFeed;
    if (tld) {
      jsonfeed.feed_url = `https://${tld}/feed.json`;
      jsonfeed.home_page_url = `https://${tld}`;
    }
    putObject(
      "feed.json",
      JSON.stringify(jsonfeed),
      "application/feed+json",
    ).catch(consola.error);
    if (title && tld) {
      putObject(
        "feed.xml",

        jsonfeedToAtom(jsonfeed) as string,
        "application/atom+xml",
      ).catch(consola.error);
      putObject(
        "feed-rss.xml",

        jsonfeedToRSS(jsonfeed) as string,
        "application/rss+xml",
      ).catch(consola.error);
    }
  }),
  { deep },
);
</script>
