<!-- eslint-disable vue/no-v-html vue/no-v-text-v-html-on-component -->
<template lang="pug">
form.full-width.col.column(
  autocapitalize="on",
  autocomplete="on",
  autocorrect="on",
  spellcheck="true"
)
  q-editor.full-width.col.column(
    ref="editor",
    paragraph-tag="p",
    :definitions,
    :dense="$q.screen.lt.md",
    :fonts,
    :model-value="htm",
    :placeholder,
    :toolbar,
    content-class="col prose max-w-none",
    flat,
    @drop="paste",
    @paste="paste",
    @update:model-value="$emit('update:modelValue', $event)"
  )
  q-tooltip.text-caption.bg-primary(
    v-if="blocks && inViewport",
    v-model="show",
    :target,
    anchor="top left",
    self="top left",
    :scroll-target,
    v-html="tagNameClassList"
  )
  q-menu(
    v-if="blocks",
    touch-position,
    context-menu,
    :target="scrollTarget",
    :scroll-target,
    @show="srcElement = target"
  )
    q-list(dense)
      q-item(
        v-close-popup,
        clickable,
        :disable="!srcElement",
        @click="openClassDialog"
      )
        q-item-section(side)
          q-icon(name="css")
        q-item-section {{ t("Edit classes") }}
</template>
<script setup lang="ts">
import type { TFonts } from "@vuebro/shared";
import type {
  QEditor,
  QEditorCommand,
  QuasarIconSetEditor,
  QuasarLanguageEditorLabel,
  StringDictionary,
} from "quasar";

import initUnocssRuntime from "@unocss/runtime";
import presets from "@vuebro/configs/uno/presets";
import { sharedStore } from "@vuebro/shared";
import { useFileDialog } from "@vueuse/core";
import mimes from "assets/mimes.json";
import VChipsInputDialog from "components/dialogs/VChipsInputDialog.vue";
import VLinkDialog from "components/dialogs/VLinkDialog.vue";
import { consola } from "consola/browser";
import { ofetch as customFetch } from "ofetch";
import { parse } from "path-browserify";
import { useQuasar } from "quasar";
import { urls } from "stores/app";
import {
  accept,
  bypassDefined,
  immediate,
  persistent,
  reset,
} from "stores/defaults";
import { putObject } from "stores/io";
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  toRefs,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";

let rootElement: () => Element | undefined;

/**
 * Converts fonts array to an object mapping with underscored keys
 *
 * @param fonts - The array of font names to convert
 * @returns An object mapping with underscored keys
 */
const getFontsObjectFromArray = (fonts: TFonts) =>
    Object.fromEntries(
      fonts.map((value) => [value.toLowerCase().replace(/ /g, "_"), value]),
    ),
  { files, open } = useFileDialog({ accept, reset }),
  { fonts: Fonts } = toRefs(sharedStore),
  { t } = useI18n();

const $q = useQuasar(),
  blocks = ref(false),
  editor = ref<QEditor>(),
  fonts = computed(() => ({
    ...getFontsObjectFromArray([
      "Arial",
      "Arial Black",
      "Comic Sans",
      "Courier New",
      "Impact",
      "Lucida Grande",
      "Times New Roman",
      "Verdana",
    ]),
    ...getFontsObjectFromArray(Fonts.value),
  })),
  props = withDefaults(
    defineProps<{
      id?: string | undefined;
      modelValue?: Promise<string> | string;
    }>(),
    {
      id: "",
      modelValue: "",
    },
  ),
  htm = ref(await props.modelValue),
  inViewport = ref(false),
  list = "no-icons",
  placeholder = t("Add some content to your page..."),
  scrollTarget = ref<Element>(),
  show = ref(false),
  srcElement = ref<boolean | Element>(true),
  tagNameClassList = ref(""),
  target = ref<boolean | Element>(false),
  toolbar = computed(() => [
    ["left", "center", "right", "justify"],
    ["bold", "italic", "strike", "underline", "subscript", "superscript"],
    ["hr", "link"],
    ["print", "fullscreen", "dashboard"],
    [
      ...[
        [
          "formatting",
          [
            "p",
            ...[...Array(6).keys()].map((key) => `h${String(key + 1)}`),
            "code",
          ],
          false,
          false,
        ],
        [
          "fontSize",
          [...Array(7).keys()].map((key) => `size-${String(key + 1)}`),
          true,
          true,
        ],
        [
          "defaultFont",
          [
            "default_font",
            ...Object.keys(fonts.value).sort((a, b) => a.localeCompare(b)),
          ],
          false,
          true,
        ],
      ].map(([key, options, fixedLabel, fixedIcon]) => ({
        fixedIcon,
        fixedLabel,
        icon: $q.iconSet.editor[
          key as keyof StringDictionary<QuasarIconSetEditor>
        ],
        label:
          $q.lang.editor[
            key as keyof StringDictionary<QuasarLanguageEditorLabel>
          ],
        list,
        options,
      })),
      "removeFormat",
    ],
    ["quote", "unordered", "ordered", "outdent", "indent"],
    ["undo", "redo"],
    ["wallpaper", "file_present"],
  ]);

const definitions = {
  ...Object.fromEntries(
    [
      [
        "dashboard",
        t("Show Blocks"),
        () => {
          blocks.value = !blocks.value;
          if (blocks.value) scrollTarget.value?.classList.add("outline");
          else scrollTarget.value?.classList.remove("outline");
        },
      ],
      ["wallpaper", t("Upload Image"), open],
      [
        "file_present",
        t("Insert Route"),
        () => {
          $q.dialog({
            component: VLinkDialog,
            componentProps: {
              message: t("Select a page to insert the corresponding link"),
              persistent,
              title: t("Internal Links"),
            },
          }).onOk((value: string) => {
            editor.value?.runCmd("createLink", value);
          });
        },
      ],
    ].map(
      ([icon, tip, handler]) =>
        [icon, { handler, icon, tip }] as [string, QEditorCommand],
    ),
  ),
  ...Object.fromEntries(
    [
      ...[...Array(6).keys()].map((key) => [
        `h${String(key + 1)}`,
        `heading${String(key + 1)}`,
      ]),
      ["p", "paragraph"],
      ["code", "code"],
    ].map(([key = "div", value]) => [
      key,
      {
        htmlTip: `<span class="prose">
  <${key} class="!my-0">${$q.lang.editor[value as keyof StringDictionary<QuasarLanguageEditorLabel>]}</${key}>
</span>`,
      },
    ]),
  ),
};

const emit = defineEmits(["update:modelValue"]),
  /**
   * Inserts an image into the editor
   *
   * @param file - The image file to be inserted
   */
  insertImage = (file: File) => {
    const message = t(
        "The graphic file type is not suitable for use on the web",
      ),
      { name, type } = file;
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
      editor.value?.runCmd(
        "insertHTML",
        `<img src="${urls.get(filePath) ?? ""}" data-src="${filePath}" alt="" decoding="async" loading="lazy" />`,
      );
    } else $q.notify({ message });
  },
  /**
   * Handles context menu events
   *
   * @param event - The context menu event
   */
  onContextmenu = (event: Event) => {
    event.stopPropagation();
  },
  /**
   * Handles mouseover events to show element info in tooltip
   *
   * @param event - The mouseover event containing currentTarget and target
   * @param event.currentTarget - The element that the event listener is
   *   attached to
   * @param event.target - The element that triggered the event
   */
  onMouseover = ({ currentTarget, target: element }: Event) => {
    if (
      blocks.value &&
      element !== currentTarget &&
      element instanceof Element
    ) {
      const { x = 0, y = 0 } =
        scrollTarget.value?.getBoundingClientRect() ?? {};
      const { left, top } = element.getBoundingClientRect();
      inViewport.value = left > x && top > y;
      const { classList, tagName } = element;
      tagNameClassList.value = [
        `<strong>${tagName.toLowerCase()}</strong>`,
        ...classList,
      ].join(".");
      target.value = element;
    } else target.value = false;
  },
  /**
   * Opens the class dialog to edit element classes
   */
  openClassDialog = () => {
    if (typeof srcElement.value !== "boolean") {
      const { classList = [] } = srcElement.value;
      $q.dialog({
        component: VChipsInputDialog,
        componentProps: {
          message: t(
            "The class global attribute is a list of the classes of the element, separated by whitespace",
          ),
          persistent,
          title: "class",
          value: [...classList],
        },
      }).onOk((className: string[]) => {
        if (typeof srcElement.value !== "boolean")
          srcElement.value.className = className.join(" ");
        emit("update:modelValue", scrollTarget.value?.innerHTML);
      });
    }
  },
  /**
   * Handles paste events, including drag-and-drop of files
   *
   * @param evt - The paste or drag event
   */
  paste = (evt: ClipboardEvent | DragEvent) => {
    const { files = [] } =
      (evt as DragEvent).dataTransfer ??
      (evt as ClipboardEvent).clipboardData ??
      {};
    if (files.length) {
      evt.preventDefault();
      evt.stopPropagation();
      [...files].forEach(insertImage);
    }
  };

watch(files, (newFiles) => {
  if (newFiles) [...newFiles].forEach(insertImage);
});

watch(target, async () => {
  show.value = false;
  await nextTick();
  show.value = true;
});

watch(
  () => props.id,
  async () => {
    htm.value = await props.modelValue;
    if (scrollTarget.value && scrollTarget.value.innerHTML !== htm.value)
      scrollTarget.value.innerHTML = htm.value;
  },
);

onMounted(() => {
  rootElement = editor.value?.getContentEl ?? (() => undefined);
  watch(
    Fonts,
    async (value) => {
      await initUnocssRuntime({
        bypassDefined,
        defaults: {
          presets: presets({
            webFontsOptions: {
              customFetch,
              fonts: getFontsObjectFromArray(value),
            },
          }),
        },
        rootElement,
      });
    },
    { immediate },
  );
  scrollTarget.value = rootElement();
  scrollTarget.value?.addEventListener("mouseover", onMouseover);
  scrollTarget.value?.addEventListener("contextmenu", onContextmenu);
  editor.value?.focus();
});

onUnmounted(() => {
  scrollTarget.value?.removeEventListener("mouseover", onMouseover);
  scrollTarget.value?.removeEventListener("contextmenu", onContextmenu);
});
</script>
<style scoped>
:deep(.outline *) {
  outline-style: dashed;
  outline-width: 2px;
  outline-offset: 2px;
  outline-color: rgb(25, 118, 210);
}
</style>
