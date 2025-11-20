<template lang="pug">
q-page-sticky(:offset="[18, 18]", position="bottom-right")
  Transition(
    appear,
    enter-active-class="animated zoomIn",
    leave-active-class="animated zoomOut"
  )
    q-fab(
      v-if="visible",
      v-model="state",
      color="accent",
      direction="up",
      icon="add"
    )
      q-fab-action(color="primary", icon="note", @click="clickAdd")
      q-fab-action(color="primary", icon="delete", @click="clickRemove")
      q-fab-action(color="secondary", icon="chevron_left", @click="clickLeft")
      q-fab-action(
        color="secondary",
        icon="chevron_right",
        @click="clickRight"
      )
      q-fab-action(color="secondary", icon="expand_more", @click="clickDown")
      q-fab-action(color="secondary", icon="expand_less", @click="clickUp")
.scroll.col
  q-tree.q-ma-xs(
    ref="qtree",
    v-model:expanded="expanded",
    no-selection-unset,
    node-key="id",
    :nodes="tree",
    :selected
  )
    template(#default-header="prop")
      .row.no-wrap.full-width.items-center(
        v-intersection="onIntersection",
        :data-id="prop.node.id",
        @dblclick="prop.node.contenteditable = true",
        @keypress.stop
      )
        q-checkbox.q-mr-xs(v-model="prop.node.enabled", dense)
        q-input.full-width.min-w-96(
          v-model.trim="prop.node.name",
          :bg-color="prop.node.id === selected ? 'primary' : undefined",
          dense,
          :error="error(prop.node)",
          :error-message="errorMessage(prop.node)",
          hide-bottom-space,
          outlined,
          :readonly="!prop.node.contenteditable",
          @click.stop="selected = prop.node.id",
          @keyup.enter="prop.node.contenteditable = false"
        )
</template>
<script setup lang="ts">
import type { TPage } from "@vuebro/shared";
import type { QTree } from "quasar";

import { sharedStore } from "@vuebro/shared";
import { useQuasar } from "quasar";
import { cancel, immediate, persistent } from "stores/defaults";
import { ioStore } from "stores/io";
import { mainStore } from "stores/main";
import { ref, toRefs, watch } from "vue";
import { useI18n } from "vue-i18n";

let selected = $toRef(mainStore, "selected"),
  state = $ref(false),
  visible = $ref(false);

const { kvNodes, nodes, tree } = $(toRefs(sharedStore));

const { add, addChild, down, left, remove, right, up } = sharedStore,
  { deleteObject } = ioStore;

const $q = useQuasar(),
  { t } = useI18n();

/**
 * Cleans up resources associated with pages
 *
 * @param value - The array of pages to clean up
 */
const cleaner = (value: null | TPage | TPage[] | undefined) => {
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
};
const errors = [
    (propNode: TPage) => !propNode.name,
    (propNode: TPage) =>
      !!nodes.find(
        (element) =>
          propNode.path &&
          ((element.id !== propNode.id && element.path === propNode.path) ||
            element.loc === propNode.path),
      ),
    (propNode: TPage) =>
      ["?", "\\", "#"].some((value) => propNode.name?.includes(value)),
  ],
  expanded = ref([tree[0]?.id]),
  qtree = $ref<QTree>(),
  value = false;

/**
 * Adds a new node to the tree structure
 */
const clickAdd = () => {
    if (selected) {
      const id = kvNodes[selected]?.parent ? add(selected) : addChild(selected);
      if (id) {
        if (kvNodes[selected]?.children.length)
          qtree?.setExpanded(selected, true);
        selected = id;
      }
    }
    state = true;
  },
  clickDown = () => {
    if (selected) down(selected);
    state = true;
  },
  clickLeft = () => {
    if (selected) {
      const id = left(selected);
      if (id) qtree?.setExpanded(id, true);
    }
    state = true;
  },
  clickRemove = () => {
    if (kvNodes[selected]?.parent)
      $q.dialog({
        cancel,
        message: t("Do you really want to delete?"),
        persistent,
        title: t("Confirm"),
      }).onOk(() => {
        if (selected) {
          cleaner(kvNodes[selected]);
          const id = remove(selected);
          if (id) selected = id;
        }
      });
    state = true;
  },
  clickRight = () => {
    if (selected) {
      const id = right(selected);
      if (id) qtree?.setExpanded(id, true);
    }
    state = true;
  },
  clickUp = () => {
    if (selected) up(selected);
    state = true;
  },
  /**
   * Checks if a page node has any validation errors
   *
   * @param propNode - The page node to check for errors
   * @returns - Whether the node has any errors
   */
  error = (propNode: TPage) =>
    errors
      .map((errFnc) => errFnc(propNode))
      .reduceRight(
        (previousValue, currentValue) => previousValue || currentValue,
      ),
  /**
   * Gets the error message for a page node, if any
   *
   * @param propNode - The page node to check
   * @returns - The error message or undefined if no error
   */
  errorMessage = (propNode: TPage) => {
    switch (true) {
      case errors[0]?.(propNode):
        return t("The name is empty");
      case errors[1]?.(propNode):
        return t("That name is already in use");
      case errors[2]?.(propNode):
        return t("Prohibited characters are used");
      default:
        return undefined;
    }
  },
  /**
   * Handles intersection observer events to determine visibility
   *
   * @param entry - The intersection observer entry
   */
  onIntersection = (entry: IntersectionObserverEntry) => {
    if (
      entry.target instanceof HTMLElement &&
      entry.target.dataset.id === selected
    )
      visible = entry.isIntersecting;
  };

watch(
  () => kvNodes[selected],
  (newVal, oldVal) => {
    visible = true;
    if (!newVal) {
      const [{ id } = {}] = nodes;
      selected = id ?? "";
    }
    if (oldVal) Reflect.defineProperty(oldVal, "contenteditable", { value });
  },
  { immediate },
);
</script>

<style scoped>
.min-w-96 {
  min-width: 96px;
}
</style>
