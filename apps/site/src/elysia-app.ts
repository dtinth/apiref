import { Elysia } from "elysia";
import { renderHome } from "./pages/home.ts";

const app = new Elysia().get(
  "/",
  () =>
    new Response(
      renderHome({
        shellBaseUrl: "https://cdn.apiref.page/assets",
      }),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    ),
);

export default app;
