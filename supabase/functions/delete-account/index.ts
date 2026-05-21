import { createDeleteAccountHandler } from './handler.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

Deno.serve(
  createDeleteAccountHandler({
    env: {
      MONEY_LEAK_SERVICE_ROLE_KEY: Deno.env.get('MONEY_LEAK_SERVICE_ROLE_KEY'),
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    },
  }),
);
