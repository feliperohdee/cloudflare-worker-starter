import { handleRpc } from 'typed-rpc/server';
import HttpError from 'use-http-error';

import browserRender from '@/worker/browser-render';
import context from '@/worker/context';
import DurableObject from '@/worker/durable-object';
import RenderCoordinator from '@/worker/browser-render/coordinator';
import Rpc from '@/worker/rpc';

const rpcHandler = async () => {
	const { request } = context.store;
	const rpc = new Rpc();
	const json = await request.json();

	if (json && typeof json === 'object' && 'id' in json) {
		HttpError.setDefaultContext({ id: json.id });
	}

	const res = await handleRpc(json, rpc, {
		getErrorCode: err => {
			if (err instanceof HttpError) {
				return err.status;
			}

			return 500;
		},
		getErrorData: err => {
			if (err instanceof HttpError) {
				return err.context;
			}

			return null;
		}
	});

	return Response.json(res, {
		headers: context.getResponseHeaders()
	});
};

const handler = {
	async fetch(
		request: Request,
		env: Env,
		executionContext: ExecutionContext
	): Promise<Response> {
		return context.run({ env, executionContext, request }, async () => {
			try {
				const { pathname } = new URL(request.url);

				// Handle RPC requests
				if (request.method === 'POST' && pathname === '/api/rpc') {
					return rpcHandler();
				}

				// Handle browser render requests
				const res = await browserRender.handler();

				if (res) {
					return res;
				}

				return env.ASSETS.fetch(request);
			} catch (err) {
				const httpError = HttpError.wrap(err as Error);

				return httpError.toResponse();
			}
		});
	}
};

export { DurableObject, RenderCoordinator };
export default handler;
