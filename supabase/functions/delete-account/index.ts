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
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    },
  }),
);
