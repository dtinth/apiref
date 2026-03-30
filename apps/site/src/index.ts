import { Elysia } from "elysia";

const app = new Elysia().get("/", () => ({
  message: "Hello from Elysia on Vercel!",
}));

export default app;
