import { defineRouter } from "#q-app/wrappers";
import { createMemoryHistory, createRouter } from "vue-router";

import routes from "./routes";

export default defineRouter(() =>
  createRouter({
    history: createMemoryHistory(process.env.VUE_ROUTER_BASE),
    routes,
  }),
);
