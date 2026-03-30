import { createRequestListener } from "@remix-run/node-fetch-server";
import * as http from "node:http";
import app from "./elysia-app.ts";

let server = http.createServer(createRequestListener(app.fetch));

server.listen(39758, () => {
  console.log("Server running at http://localhost:39758");
});
