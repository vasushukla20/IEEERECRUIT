import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import handler from "./api/chat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  try {

    // ============================
    // API ROUTE
    // ============================
    if (req.url === "/api/chat") {

      let body = "";

      for await (const chunk of req) {
        body += chunk;
      }

      if (body) {
        try {
          req.body = JSON.parse(body);
        } catch {
          req.body = {};
        }
      }

      // Make Node response behave like Vercel response
      res.status = function (code) {
        res.statusCode = code;
        return res;
      };

      res.json = function (data) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
      };

      await handler(req, res);
      return;
    }


    // ============================
    // FRONTEND
    // ============================

    let requestedPath = req.url.split("?")[0];

    if (requestedPath === "/") {
      requestedPath = "/index.html";
    }

    const filePath = path.join(
      __dirname,
      decodeURIComponent(requestedPath)
    );

    const data = await fs.readFile(filePath);

    if (filePath.endsWith(".html")) {
      res.setHeader("Content-Type", "text/html");
    }

    if (filePath.endsWith(".js")) {
      res.setHeader(
        "Content-Type",
        "application/javascript"
      );
    }

    if (filePath.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css");
    }

    res.statusCode = 200;
    res.end(data);

  } catch (error) {

    res.statusCode = 404;

    res.end("Not Found");

  }
});


server.listen(PORT, () => {

  console.log("");
  console.log("=================================");
  console.log(" IEEE RAS RAG Assistant");
  console.log("=================================");
  console.log("");
  console.log(`Running at:`);
  console.log(`http://localhost:${PORT}`);
  console.log("");
  console.log("Press CTRL+C to stop");
  console.log("");

});