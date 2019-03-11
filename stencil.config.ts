import { Config } from "@stencil/core";

export const config: Config = {
  namespace: "autocomplete",
  bundles: [{ components: ["auto-complete"] }],
  outputTargets: [
    { type: "dist" },
    {
      type: "www",
      serviceWorker: {
        skipWaiting: true,
        clientsClaim: true
      }
    }
  ]
};
