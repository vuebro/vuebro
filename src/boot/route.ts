import { defineBoot } from "#q-app/wrappers";
import { tree } from "@vuebro/shared";
import routes from "src/router/routes";
import { selected } from "stores/app";
import { bucket } from "stores/io";

export default defineBoot(({ router }) => {
  const [route] = routes;
  router.beforeEach(({ path }, _from, next) => {
    if (["/", "/main"].includes(path)) next();
    else next("/");
    if (path === "/" && route) {
      bucket.value = "";
      selected.value = undefined;
      tree.length = 0;
      router.clearRoutes();
      router.addRoute(route);
    }
  });
});
