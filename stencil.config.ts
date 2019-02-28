import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'auto-complete',
  outputTargets: [
    { type: 'dist' },
    {
      type: 'www',
      serviceWorker: null // disable service workers
    }
  ]
};
