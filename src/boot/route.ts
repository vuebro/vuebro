import { defineBoot } from "#q-app/wrappers";
import { sharedStore } from "@vuebro/shared";
import routes from "src/router/routes";
import { ioStore } from "stores/io";
import { mainStore } from "stores/main";

const tree = $toRef(sharedStore, "tree");

export default defineBoot(({ router }) => {
  const [route] = routes;
  router.beforeEach(({ path }, _from, next) => {
    if (["/", "/main"].includes(path)) next();
    else next("/");
    if (path === "/" && route) {
      ioStore.bucket = "";
      mainStore.selected = "";
      tree.length = 0;
      router.clearRoutes();
      router.addRoute(route);
    }
  });
});
