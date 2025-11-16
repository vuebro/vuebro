<template lang="pug">
q-page-sticky(position="bottom-right", :offset="[18, 18]")
  Transition(
    appear,
    enter-active-class="animated zoomIn",
    leave-active-class="animated zoomOut"
  )
    q-fab(
      v-if="visible",
      v-model="state",
      icon="add",
      direction="up",
      color="accent"
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
    :nodes="tree",
    :selected,
    no-selection-unset,
    node-key="id"
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
          :error="error(prop.node)",
          :error-message="errorMessage(prop.node)",
          :readonly="!prop.node.contenteditable",
          dense,
          hide-bottom-space,
          outlined,
          @click.stop="selected = prop.node.id",
          @keyup.enter="prop.node.contenteditable = false"
        )
</template>
<script setup lang="ts">
import type { TPage } from "@vuebro/shared";
import type { QTree } from "quasar";

import { sharedStore } from "@vuebro/shared";
import { useQuasar } from "quasar";
import { mainStore } from "stores/app";
import { cancel, immediate, persistent } from "stores/defaults";
import { deleteObject } from "stores/io";
import { computed, ref, toRef, toRefs, watch } from "vue";
import { useI18n } from "vue-i18n";

const selected = toRef(mainStore, "selected");
const { add, addChild, down, left, remove, right, up } = sharedStore;
const { kvNodes, nodes, tree } = toRefs(sharedStore);
const { t } = useI18n();

const $q = useQuasar(),
  /**
   * Cleans up resources associated with pages
   *
   * @param value - The array of pages to clean up
   */
  cleaner = (value: null | TPage | TPage[] | undefined) => {
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
  errors = [
    (propNode: TPage) => !propNode.name,
    (propNode: TPage) =>
      !!nodes.value.find(
        (element) =>
          propNode.path &&
          ((element.id !== propNode.id && element.path === propNode.path) ||
            element.loc === propNode.path),
      ),
    (propNode: TPage) =>
      ["?", "\\", "#"].some((value) => propNode.name?.includes(value)),
  ],
  expanded = ref([tree.value[0]?.id]),
  message = t("Do you really want to delete?"),
  qtree = ref<QTree>(),
  state = ref(false),
  the = computed(() =>
    nodes.value.length ? (kvNodes.value[selected.value] ?? null) : undefined,
  ),
  title = t("Confirm"),
  value = false,
  visible = ref(false);
/**
 * Adds a new node to the tree structure
 */
const clickAdd = () => {
    if (the.value?.id) {
      const id = the.value.parent ? add(the.value.id) : addChild(the.value.id);
      if (id) {
        if (the.value.children.length)
          qtree.value?.setExpanded(the.value.id, true);
        selected.value = id;
      }
    }
    state.value = true;
  },
  clickDown = () => {
    if (the.value?.id) down(the.value.id);
    state.value = true;
  },
  clickLeft = () => {
    if (the.value?.id) {
      const id = left(the.value.id);
      if (id) qtree.value?.setExpanded(id, true);
    }
    state.value = true;
  },
  clickRemove = () => {
    if (the.value?.parent)
      $q.dialog({ cancel, message, persistent, title }).onOk(() => {
        if (the.value?.id) {
          cleaner(the.value);
          const id = remove(the.value.id);
          if (id) selected.value = id;
        }
      });
    state.value = true;
  },
  clickRight = () => {
    if (the.value?.id) {
      const id = right(the.value.id);
      if (id) qtree.value?.setExpanded(id, true);
    }
    state.value = true;
  },
  clickUp = () => {
    if (the.value?.id) up(the.value.id);
    state.value = true;
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
      entry.target.dataset.id === selected.value
    )
      visible.value = entry.isIntersecting;
  };
watch(
  the,
  (newVal, oldVal) => {
    visible.value = true;
    if (!newVal) {
      const [{ id } = {}] = nodes.value;
      selected.value = id ?? "";
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
