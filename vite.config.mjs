import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const qaContactInstrumentation = `<script data-qa-contact-instrument>
(() => {
  const events = [];
  const record = (event) => {
    events.push(event);
    document.documentElement.dataset.qaContactEvents = JSON.stringify(events);
  };
  window.ym = (...args) => record({ kind: "ym", args });
  window.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    const isContactLink = link && (
      link.protocol === "tel:"
      || link.protocol === "mailto:"
      || (link.protocol === "https:" && link.hostname === "wa.me")
    );
    if (!isContactLink) return;
    const destination = { href: link.href, target: link.target || null };
    record({ kind: "contact-click", ...destination, defaultPreventedBefore: event.defaultPrevented });
    event.preventDefault();
    record({ kind: "contact-navigation-intercepted", ...destination, defaultPreventedAfter: event.defaultPrevented });
  }, true);
})();
</script>`;

function cleanStaticPreviewRoutes() {
  return {
    name: "clean-static-preview-routes",
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") return next();

        let url;
        try {
          url = new URL(request.url ?? "/", "http://preview.local");
        } catch {
          return next();
        }
        let pathname;
        try {
          pathname = decodeURIComponent(url.pathname);
        } catch {
          response.statusCode = 400;
          response.setHeader("Content-Type", "text/plain; charset=utf-8");
          return response.end("Bad Request");
        }

        if (pathname === "/" || pathname.endsWith("/")) return next();

        const outputRoot = path.resolve(server.config.root, server.config.build.outDir);
        const routeFile = path.resolve(outputRoot, `.${pathname}`, "index.html");
        if (!routeFile.startsWith(`${outputRoot}${path.sep}`)) return next();

        try {
          if (!(await stat(routeFile)).isFile()) return next();
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          if (request.method === "HEAD") return response.end();
          const html = await readFile(routeFile, "utf8");
          response.end(url.searchParams.get("__qa_contact_instrument") === "1"
            ? html.replace("</head>", `${qaContactInstrumentation}</head>`)
            : html);
        } catch (error) {
          if (error?.code === "ENOENT") return next();
          return next(error);
        }
      });
    },
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  build: {
    outDir: "dist/client",
    ...(isSsrBuild ? {
      rollupOptions: {
        output: {
          entryFileNames: "entry-server.js",
        },
      },
    } : {}),
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), cleanStaticPreviewRoutes()],
}));
