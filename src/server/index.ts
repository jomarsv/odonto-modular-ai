import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { app } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const clientDist = path.resolve(__dirname, "../client");
app.use(express.static(clientDist));
app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));

app.listen(config.port, () => {
  console.log(`API Odonto Modular AI em http://localhost:${config.port}`);
});
