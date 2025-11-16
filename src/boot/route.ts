import { defineBoot } from "#q-app/wrappers";
import { sharedStore } from "@vuebro/shared";
import routes from "src/router/routes";
import { mainStore } from "stores/app";
import { bucket } from "stores/io";
import { toRef } from "vue";

const tree = toRef(sharedStore, "tree");
const selected = toRef(mainStore, "selected");

export default defineBoot(({ router }) => {
  const [route] = routes;
  router.beforeEach(({ path }, _from, next) => {
    if (["/", "/main"].includes(path)) next();
    else next("/");
    if (path === "/" && route) {
      bucket.value = "";
      selected.value = "";
      tree.value.length = 0;
      router.clearRoutes();
      router.addRoute(route);
    }
  });
});
