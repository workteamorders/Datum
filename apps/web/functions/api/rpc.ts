import { handleRpc, type RpcEnv } from "../../src/server/rpc-handler";

/** Cloudflare Pages Function: /api/rpc. The logic lives in src/server/rpc-handler.ts so it can be tested. */
export const onRequest = (context: { request: Request; env: RpcEnv }): Promise<Response> => handleRpc(context.request, context.env);
