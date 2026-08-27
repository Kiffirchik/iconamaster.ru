export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    const redirectLocation = response.headers.get("location");
    const redirectsAppRouteToRoot =
      response.status >= 300 &&
      response.status < 400 &&
      redirectLocation &&
      new URL(redirectLocation, request.url).pathname === "/";

    if (
      (response.status !== 404 && !redirectsAppRouteToRoot) ||
      !acceptsHtml ||
      !["GET", "HEAD"].includes(request.method)
    ) {
      return response;
    }

    const appShellUrl = new URL(request.url);
    appShellUrl.pathname = "/";
    appShellUrl.search = "";
    return env.ASSETS.fetch(new Request(appShellUrl, request));
  },
};
