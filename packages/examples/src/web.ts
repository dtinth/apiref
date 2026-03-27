import { Elysia } from "elysia";

const app = new Elysia()
  .get("/", () => "Hello, world!")
  .get("/user/:id", ({ params }) => `User ID: ${params.id}`);

export default app;
export type App = typeof app;
