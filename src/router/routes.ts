import MainLayout from "layouts/MainLayout.vue";
import HomePage from "pages/HomePage.vue";

export default [
  {
    children: [
      {
        component: HomePage,
        name: "Home",
        path: "",
      },
    ],
    component: MainLayout,
    path: "/",
  },
];
