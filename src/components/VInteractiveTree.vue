<template lang="pug">
q-page-sticky(:offset="[15, 15]", position="bottom-right")
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
  q-tree.q-ma-md(
    v-if="nodes[0]",
    ref="qtree",
    v-model:expanded="expanded",
    dense,
    no-selection-unset,
    node-key="id",
    :nodes="[nodes[0]]",
    :selected
  )
    template(#default-header="prop")
      .row.no-wrap.full-width.items-center(
        v-intersection="onIntersection",
        :data-id="prop.node.id",
        @dblclick="prop.node.contenteditable = true",
        @keypress.stop
      )
        q-input.full-width(
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
import { consola } from "consola/browser";
import { storeToRefs } from "pinia";
import { debounce, useQuasar } from "quasar";
import { cancel, deep, immediate, persistent, second } from "stores/defaults";
import { ioStore } from "stores/io";
import { useMainStore } from "stores/main";
import { ref, toRefs, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";

const mainStore = useMainStore();

let state = $ref(false),
  visible = $ref(false),
  { selected } = $(storeToRefs(mainStore));

const { kvNodes, nodes } = $(toRefs(sharedStore));

const $q = useQuasar(),
  errors = [
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
  expanded = ref([nodes[0]?.id]),
  qtree = $(useTemplateRef<QTree>("qtree")),
  { add, addChild, down, left, remove, right, up } = sharedStore,
  { putObject } = ioStore,
  { putPages, putSitemap } = mainStore,
  { t } = useI18n();

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
  error = (propNode: TPage) =>
    errors
      .map((errFnc) => errFnc(propNode))
      .reduceRight(
        (previousValue, currentValue) => previousValue || currentValue,
      ),
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
  onIntersection = (entry: IntersectionObserverEntry) => {
    if (
      entry.target instanceof HTMLElement &&
      entry.target.dataset.id === selected
    )
      visible = entry.isIntersecting;
    return true;
  };

watch(
  $$(selected),
  (newVal, oldVal) => {
    visible = true;
    if (!newVal) {
      const [{ id } = {}] = nodes;
      selected = id ?? "";
    }
    if (oldVal && kvNodes[oldVal])
      Reflect.defineProperty(kvNodes[oldVal], "contenteditable", {
        value: false,
      });
  },
  { immediate },
);

watch(
  $$(nodes),
  debounce((value) => {
    putObject(
      "index.json",
      JSON.stringify([value[0]]),
      "application/json",
    ).catch(consola.error);
    putSitemap().catch(consola.error);
    putPages().catch(consola.error);
  }, second),
  { deep },
);
</script>

<style scoped>
.min-w-96 {
  min-width: 96px;
}
</style>
