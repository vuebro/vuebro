import { defineBoot } from "#q-app/wrappers";
import { sharedStore } from "@vuebro/shared";
import routes from "src/router/routes";
import { ioStore } from "stores/io";
import { mainStore } from "stores/main";
import { toRef } from "vue";

const bucket = toRef(ioStore, "bucket"),
  selected = toRef(mainStore, "selected"),
  tree = $toRef(sharedStore, "tree");

export default defineBoot(({ router }) => {
  const [route] = routes;
  router.beforeEach(({ path }, _from, next) => {
    if (["/", "/main"].includes(path)) next();
    else next("/");
    if (path === "/" && route) {
      bucket.value = "";
      selected.value = "";
      tree.length = 0;
      router.clearRoutes();
      router.addRoute(route);
    }
  });
});
