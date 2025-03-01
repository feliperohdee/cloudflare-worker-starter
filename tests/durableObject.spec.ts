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

	it('should insert and list', async () => {
		const id = env.DO.newUniqueId();
		const stub = env.DO.get(id);

		await runInDurableObject(stub, async (instance: DurableObject, state) => {
			const res = await instance.insertAndList({
				age: 20,
				email: 'test@test.com',
				name: 'Test User'
			});

			expect(res).toEqual([{
				age: 20,
				email: 'test@test.com',
				id: expect.any(String),
				name: 'Test User'
			}]);
		});
	});

	it('should insert post', async () => {
		const id = env.DO.newUniqueId();
		const stub = env.DO.get(id);

		await runInDurableObject(stub, async (instance: DurableObject, state) => {
			const user = await instance.insert({
				age: 20,
				email: 'test@test.com',
				name: 'Test User'
			});

			console.log(user);
			
			const res = await instance.insertPost({
				title: 'Test Post',
				userId: user[0].id
			});

			const res2 = await instance.getWithRelations();

			console.log(JSON.stringify(res2, null, 2));

			// expect(res).toEqual({
			// 	id: expect.any(String),
			// 	title: 'Test Post'
			// });
		});
	});
});
