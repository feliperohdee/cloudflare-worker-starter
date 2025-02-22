import { env, runInDurableObject } from 'cloudflare:test';

import { describe, it, expect } from 'vitest';
import DurableObject from '../src/durableObject';

describe('/durableObject', () => {
	it('should say hello', async () => {
		const id = env.DO.newUniqueId();
		const stub = env.DO.get(id);

		await runInDurableObject(
			stub,
			async (instance: DurableObject, state) => {
				const res = await instance.sayHello();

				expect(res).toEqual({ greeting: 'Hello, World!' });
			}
		);
	});
});
