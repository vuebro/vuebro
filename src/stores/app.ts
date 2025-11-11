import type { TFeed, TImportmap, TPage } from "@vuebro/shared";
import type { Ref } from "vue";
import type { SFCDescriptor } from "vue/compiler-sfc";

import { feed, fonts, importmap, kvNodes, nodes, tree } from "@vuebro/shared";
import { consola } from "consola/browser";
import jsonfeedToAtom from "jsonfeed-to-atom";
import jsonfeedToRSS from "jsonfeed-to-rss";
import { editor, Uri } from "monaco-editor";
import { ofetch } from "ofetch";
import { debounce } from "quasar";
import { cache, deep, second, writable } from "stores/defaults";
import {
  bucket,
  deleteObject,
  getObjectBlob,
  getObjectText,
  headObject,
  putObject,
  removeEmptyDirectories,
} from "stores/io";
import { toXML } from "to-xml";
import { computed, reactive, ref, watch } from "vue";
import toString from "vue-sfc-descriptor-to-string";
import { parse } from "vue/compiler-sfc";

export type TAppPage = TPage & {
  contenteditable: boolean;
  html: Promise<string> | string;
  jsonld: Promise<editor.ITextModel>;
  sfc: Promise<editor.ITextModel>;
};

let descriptor: SFCDescriptor | undefined;

const [index, manifest] = await Promise.all(
    ["index.html", ".vite/manifest.json"].map((value) =>
      ofetch(`runtime/${value}`),
    ),
  ),
  body = computed(() =>
    index
      .replace(
        '<base href="" />',
        `<base href="" />
    <script type="importmap">
${JSON.stringify(importmap, null, 1)}
    </script>
    <link rel="alternate" title="${nodes.value[0]?.title ?? ""}" type="application/feed+json" href="./feed.json" />
    <link rel="alternate" title="${nodes.value[0]?.title ?? ""}" type="application/atom+xml" href="./feed.xml" />
    <link rel="alternate" title="${nodes.value[0]?.title ?? ""}" type="application/rss+xml" href="./feed-rss.xml" />`,
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
  /**
   * Parses a string into an HTML document
   *
   * @param value - The HTML string to parse
   * @returns The parsed HTML document
   */
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
/*                              Экспортный раздел                             */
/* -------------------------------------------------------------------------- */

/**
 * Cleans up resources associated with pages
 *
 * @param value - The array of pages to clean up
 */
export const cleaner = (value: null | TPage | TPage[] | undefined) => {
    if (value)
      (Array.isArray(value) ? value : [value]).forEach(
        ({ children, id, images }) => {
          cleaner(children);
          images.forEach(({ url }) => {
            void deleteObject(url);
          });
          if (id) {
            void deleteObject(`pages/${id}.vue`);
            void deleteObject(`pages/${id}.jsonld`);
          }
        },
      );
  },
  domain = ref(""),
  rightDrawer = ref(false),
  selected: Ref<string | undefined> = ref(),
  staticEntries = Object.values(
    manifest as Record<string, Record<string, string>>,
  )
    .filter(({ isStaticEntry }) => isStaticEntry)
    .map(({ file, name }) => [name, file]),
  the = computed(
    () =>
      (kvNodes.value[selected.value ?? ""] ?? nodes.value[0]) as
        | TAppPage
        | undefined,
  ),
  urls = reactive(new Map<string, string>());

/* -------------------------------------------------------------------------- */
/*                                 Функционал                                 */
/* -------------------------------------------------------------------------- */

/**
 * Handles the page putting operation
 *
 * @param params - The page parameters
 * @param params.branch - The branch of the page
 * @param params.description - The description of the page
 * @param params.images - The images associated with the page
 * @param params.jsonld - The JSON-LD model
 * @param params.keywords - Keywords for the page
 * @param params.loc - The location of the page
 * @param params.path - The path of the page
 * @param params.title - The title of the page
 * @param params.to - The destination of the page
 * @param params.type - The type of the page
 */
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
      domain.value && `https://${domain.value}${to === "/" ? "" : (to ?? "")}`,
    htm = body.value
      .replace(
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
      ...(domain.value
        ? images.flatMap(({ alt, url }) => [
            [url ? `https://${domain.value}/${url}` : "", "image"],
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
    </script>`
    }
  </head>`,
      );

  if (loc)
    putObject(`${loc}/index.html`, htm, "text/html").catch(consola.error);

  putObject(path ? `${path}/index.html` : "index.html", htm, "text/html").catch(
    consola.error,
  );
};

/**
 * Gets or creates a Monaco editor model
 *
 * @param id - The ID of the model
 * @param ext - The file extension
 * @param language - The programming language
 * @param mime - The MIME type
 * @param init - The initial content
 * @returns The Monaco editor model
 */
const getModel = async (
  id: string,
  ext: string,
  language: string,
  mime: string,
  init: string,
) => {
  const uri = Uri.parse(`file:///${id}.${language}`);
  let model = editor.getModel(uri);
  /**
   * Initializes the object by saving model content to storage
   */
  const initObject = () => {
    if (model && id) {
      putObject(`pages/${id}.${ext}`, model.getValue(), mime).catch(
        consola.error,
      );
      if (language === "json" && kvNodes.value[id])
        void putPage(kvNodes.value[id] as TAppPage);
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
    /**
     * Gets the HTML content for a page
     *
     * @returns The HTML content
     */
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
    /**
     * Sets the HTML content for a page
     *
     * @param value - The HTML string to set
     */
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
    /**
     * Gets the JSON-LD model for a page
     *
     * @returns The JSON-LD model
     */
    get(this: TAppPage) {
      return this.id
        ? getModel(this.id, "jsonld", "json", "application/ld+json", initJsonLD)
        : undefined;
    },
  },
  sfc = {
    /**
     * Gets the SFC (Single File Component) model for a page
     *
     * @returns The SFC model
     */
    get(this: TAppPage) {
      return this.id
        ? getModel(this.id, "vue", "vue", "text/plain", "<template></template>")
        : undefined;
    },
  };

/* -------------------------------------------------------------------------- */
/*                             Функции смотрителей                            */
/* -------------------------------------------------------------------------- */

/**
 * Watcher function that handles clearing images when the page changes.
 *
 * @param value The new page value that triggered the watcher
 * @param oldValue The previous page value before the change
 */
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
  /**
   * Defines properties on an array of page objects
   *
   * @param objects The array of page objects to define properties on
   */
  defineProperties = (objects: TPage[]) => {
    objects.forEach((object) => {
      Object.defineProperties(object, {
        contenteditable,
        html,
        jsonld,
        sfc,
      });
    });
  },
  /**
   * Initializes the application with data from storage
   *
   * @param value The initialization value that triggers data loading when
   *   truthy
   */
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

      tree.push(JSON.parse(getIndex ?? "[{}]")[0] ?? {});
      fonts.length = 0;
      fonts.push(...JSON.parse(getFonts ?? "[]"));
      importmap.imports = imports;
      feed.items = items;
      domain.value = cname.trim();
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

watch(the, clearImages, { deep });
watch(nodes, defineProperties);
watch(bucket, init);

watch(domain, (cname) => {
  putObject("CNAME", cname, "text/plain").catch(consola.error);
});

watch(
  tree,
  debounce((value) => {
    if (value)
      putObject("index.json", JSON.stringify(value), "application/json").catch(
        consola.error,
      );
  }, second),
  { deep },
);

watch(
  fonts,
  debounce((value, oldValue) => {
    if (oldValue)
      putObject("fonts.json", JSON.stringify(value), "application/json").catch(
        consola.error,
      );
  }),
);

watch(
  importmap,
  debounce((value, oldValue) => {
    const { imports } = value as TImportmap;
    let save = Boolean(oldValue);
    staticEntries.forEach(([key = "", value = ""]) => {
      if (imports[key] !== `./${value}`) {
        imports[key] = `./${value}`;
        save = true;
      }
    });
    if (save)
      putObject(
        "index.importmap",
        JSON.stringify({ imports }),
        "application/importmap+json",
      ).catch(consola.error);
  }),
  { deep },
);

watch(
  [nodes, feed, domain],
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
  [nodes, domain],
  debounce((arr) => {
    const [page, cname] = arr as [TPage[], string];
    if (cname) {
      putObject(
        "sitemap.xml",
        toXML({
          "?": 'xml version="1.0" encoding="UTF-8"',
          urlset: {
            "@xmlns": "https://www.sitemaps.org/schemas/sitemap/0.9",
            url: [
              ...page
                .filter(({ enabled, path }) => enabled && path !== undefined)
                .map(({ changefreq, lastmod, priority, to }) => ({
                  ...(changefreq && { changefreq }),
                  ...(lastmod && { lastmod }),
                  ...(priority && { priority }),
                  loc: `https://${cname}${to === "/" ? "" : encodeURI(to ?? "")}`,
                })),
              ...page
                .filter(({ enabled, loc }) => enabled && loc)
                .map(({ changefreq, lastmod, loc, priority }) => ({
                  ...(changefreq && { changefreq }),
                  ...(lastmod && { lastmod }),
                  ...(priority && { priority }),
                  loc: `https://${cname}${encodeURI(loc?.replace(/^\/?/, "/").replace(/\/?$/, "/") ?? "")}`,
                })),
            ],
          },
        }),
        "application/xml",
      ).catch(consola.error);
    }
  }, second),
  { deep },
);

watch(
  [nodes, importmap, domain],
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
