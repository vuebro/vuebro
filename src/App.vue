<template lang="pug">
router-view
</template>

<script setup lang="ts">
import type { TFeed, TImportmap, TPage } from "@vuebro/shared";
import type { TAppPage } from "stores/main";
import type { SFCDescriptor } from "vue/compiler-sfc";

import { sharedStore } from "@vuebro/shared";
import { useFetch } from "@vueuse/core";
import { consola } from "consola/browser";
import jsonfeedToAtom from "jsonfeed-to-atom";
import jsonfeedToRSS from "jsonfeed-to-rss";
import { editor, Uri } from "monaco-editor";
import { debounce } from "quasar";
import { cache, deep, second, writable } from "stores/defaults";
import { ioStore } from "stores/io";
import { mainStore } from "stores/main";
import { toRef, toRefs, watch } from "vue";
import toString from "vue-sfc-descriptor-to-string";
import { parse } from "vue/compiler-sfc";
// eslint-disable-next-line import-x/no-unresolved
import "virtual:uno.css";

let descriptor: SFCDescriptor | undefined,
  domain = $toRef(mainStore, "domain"),
  tree = $toRef(sharedStore, "tree");

const { data: index } = $(useFetch(`runtime/index.html`).text());
const { feed, importmap, kvNodes, nodes } = $(toRefs(sharedStore));

const bucket = toRef(ioStore, "bucket"),
  selected = $toRef(mainStore, "selected"),
  {
    deleteObject,
    getObjectBlob,
    getObjectText,
    headObject,
    putObject,
    removeEmptyDirectories,
  } = ioStore,
  { manifest, urls } = mainStore;

const body = $computed(() =>
    index
      ?.replace(
        '<base href="" />',
        `<base href="" />
    <script type="importmap">
${JSON.stringify(importmap, null, 1)}
    <\\/script>
    <link rel="alternate" title="${nodes[0]?.title ?? ""}" type="application/feed+json" href="./feed.json" />
    <link rel="alternate" title="${nodes[0]?.title ?? ""}" type="application/atom+xml" href="./feed.xml" />
    <link rel="alternate" title="${nodes[0]?.title ?? ""}" type="application/rss+xml" href="./feed-rss.xml" />`,
      )
      .replace(
        "</head>",
        `  ${Object.values(importmap.imports)
          .filter((href) => !href.endsWith("/"))
          .map(
            (href) => `<link rel="modulepreload" crossorigin href="${href}">`,
          ).join(`
    `)}
  </head>`,
      ),
  ),
  domParser = new DOMParser(),
  getDocument = (value: string) =>
    domParser.parseFromString(
      `<head><base href="//"></head><body>${value}</body>`,
      "text/html",
    ),
  initJsonLD = `{
    "@context": "https://schema.org"
}`,
  oldPages: Record<string, null | string | undefined>[] = [],
  prevImages: string[] = [],
  routerLink = "router-link";

/* -------------------------------------------------------------------------- */
/*                                 Функционал                                 */
/* -------------------------------------------------------------------------- */

const putPage = async ({
  branch,
  description,
  images,
  jsonld,
  keywords,
  loc,
  path,
  title,
  to,
  type,
}: TAppPage) => {
  let value;
  try {
    value = JSON.stringify(JSON.parse((await jsonld).getValue()), null, 1);
  } catch {
    value = JSON.stringify(JSON.parse(initJsonLD), null, 1);
  }
  const canonical =
      domain && `https://${domain}${to === "/" ? "" : (to ?? "")}`,
    htm = body
      ?.replace(
        '<base href="" />',
        `<base href="${
          Array(branch.length - 1)
            .fill("..")
            .join("/") || "./"
        }" />`,
      )
      .replace(
        "</head>",
        `  <title>${title ?? ""}</title>
    ${canonical && `<link rel="canonical" href="${canonical.replaceAll('"', "&quot;")}">`}
    ${[
      [description ?? "", "description"],
      [keywords.join(), "keywords"],
    ]
      .filter(([content]) => content)
      .map(
        ([content, name]) =>
          content &&
          name &&
          `<meta name="${name}" content="${content.replaceAll('"', "&quot;")}">`,
      ).join(`
    `)}
    ${[
      [canonical, "url"],
      [description ?? "", "description"],
      [title, "title"],
      [type ?? "", "type"],
      ...(domain
        ? images.flatMap(({ alt, url }) => [
            [url ? `https://${domain}/${url}` : "", "image"],
            [alt ?? "", "image:alt"],
          ])
        : []),
    ]
      .filter(([content]) => content)
      .map(
        ([content, property]) =>
          content &&
          property &&
          `<meta property="og:${property}" content="${content.replaceAll('"', "&quot;")}">`,
      ).join(`
    `)}
    ${
      value &&
      `<script type="application/ld+json" id="application/ld+json">
${value}
    <\\/script>`
    }
  </head>`,
      );

  if (htm !== undefined) {
    if (loc)
      putObject(`${loc}/index.html`, htm, "text/html").catch(consola.error);

    putObject(
      path ? `${path}/index.html` : "index.html",
      htm,
      "text/html",
    ).catch(consola.error);
  }
};

const getModel = async (
  id: string,
  ext: string,
  language: string,
  mime: string,
  init: string,
) => {
  const uri = Uri.parse(`file:///${id}.${language}`);
  let model = editor.getModel(uri);
  const initObject = () => {
    if (model && id) {
      putObject(`pages/${id}.${ext}`, model.getValue(), mime).catch(
        consola.error,
      );
      if (language === "json" && kvNodes[id])
        void putPage(kvNodes[id] as TAppPage);
    }
  };
  if (!model) {
    const value = await getObjectText(`pages/${id}.${ext}`, cache);
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
  html = {
    async get(this: TAppPage) {
      ({ descriptor } = parse((await this.sfc).getValue()));
      const { template } = descriptor;
      const { content } = template ?? {};
      const doc = getDocument(content ?? "");
      doc.querySelectorAll(routerLink).forEach((link) => {
        const a = document.createElement("a");
        a.innerHTML = link.innerHTML;
        a.setAttribute(`data-${routerLink}`, "true");
        [...link.attributes].forEach((attr) => {
          if (attr.nodeName === "to")
            a.setAttribute("href", attr.nodeValue ?? "");
          else a.setAttributeNode(attr.cloneNode() as Attr);
        });
        link.replaceWith(a);
      });
      (
        await Promise.all(
          [...doc.images].map((image) => {
            const src = image.getAttribute("src");
            return src && !urls.has(src)
              ? getObjectBlob(src)
              : Promise.resolve(undefined);
          }),
        )
      ).forEach((image, index) => {
        const src = doc.images[index]?.getAttribute("src") ?? "";
        if (image?.size) urls.set(src, URL.createObjectURL(image));
        const url = urls.get(src);
        if (url) {
          doc.images[index]?.setAttribute("data-src", src);
          doc.images[index]?.setAttribute("src", url);
        }
      });
      return doc.body.innerHTML;
    },
    async set(this: TAppPage, value: string) {
      const doc = getDocument(value),
        sfc: editor.ITextModel = await this.sfc;
      doc.querySelectorAll("a").forEach((a) => {
        try {
          const url = new URL(
            a.attributes.getNamedItem("href")?.value ?? "",
            window.location.origin,
          );
          if (
            Boolean(a.dataset[routerLink]) ||
            (window.location.origin === url.origin &&
              url.href === `${url.origin}${url.pathname}`)
          ) {
            a.removeAttribute(`data-${routerLink}`);
            const link = document.createElement(routerLink);
            link.innerHTML = a.innerHTML;
            [...a.attributes].forEach((attr) => {
              if (attr.nodeName === "href")
                link.setAttribute("to", attr.nodeValue ?? "");
              else link.setAttributeNode(attr.cloneNode() as Attr);
            });
            a.replaceWith(link);
          }
        } catch {
          //
        }
      });
      [...doc.images].forEach((image) => {
        if (image.dataset.src) {
          image.setAttribute("src", image.dataset.src);
          image.removeAttribute("data-src");
        }
      });
      if (descriptor) {
        if (descriptor.template)
          descriptor.template.content = doc.body.innerHTML;
        sfc.setValue(
          `${
            descriptor.template
              ? ""
              : `<template>${doc.body.innerHTML}</template>
`
          }${(toString as (sfcDescriptor: SFCDescriptor) => string)(descriptor)}`,
        );
      }
    },
  },
  jsonld = {
    get(this: TAppPage) {
      return this.id
        ? getModel(this.id, "jsonld", "json", "application/ld+json", initJsonLD)
        : undefined;
    },
  },
  sfc = {
    get(this: TAppPage) {
      return this.id
        ? getModel(this.id, "vue", "vue", "text/plain", "<template></template>")
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
      importmap.imports = imports;
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

watch($$(nodes), (objects) => {
  objects.forEach((object) => {
    Object.defineProperties(object, {
      contenteditable,
      html,
      jsonld,
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

watch(
  [$$(nodes), $$(importmap), $$(domain)],
  debounce(async ([page]: [TPage[], TImportmap, string]) => {
    const promises: Promise<void>[] = [];
    oldPages.forEach(({ loc, path }) => {
      if (loc && !page.find((value) => value.loc === loc))
        promises.push(deleteObject(`${loc}/index.html`));
      if (!page.find((value) => value.path === path))
        promises.push(deleteObject(path ? `${path}/index.html` : "index.html"));
    });
    await Promise.allSettled(promises);
    await removeEmptyDirectories();
    oldPages.length = 0;
    (page as TAppPage[])
      .filter(({ path }) => path !== undefined)
      .forEach((value) => {
        const { loc, path } = value;
        oldPages.push({ loc, path });
        void putPage(value);
      });
  }, second),
  { deep },
);
</script>
