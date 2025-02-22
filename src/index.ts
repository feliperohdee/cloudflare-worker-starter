import Do from './durableObject';

const handler = {
	async fetch(
		req: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const id: DurableObjectId = env.DO.idFromName('rohde');
		const stub = env.DO.get(id);
		const res = await stub.sayHello();

		return Response.json(res);
	}
};

export { Do };
export default handler;
