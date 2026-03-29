/**
 * An example Elysia application to demonstrate the capabilities of the API reference generator.
 * @module
 */
import { Elysia } from "elysia";

/** An example Elysia application */
const app = new Elysia()
  .get("/", () => "Hello, world!")
  .get("/user/:id", ({ params }) => `User ID: ${params.id}`);

/** A default export */
export default app;

/** Type of the Elysia application */
export type App = typeof app;
