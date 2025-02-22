import { DurableObject } from 'cloudflare:workers';

class Do extends DurableObject<Env> {
	public ctx: DurableObjectState;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.ctx = ctx;
	}

	async sayHello() {
		let res = this.ctx.storage.sql
			.exec(`SELECT 'Hello, World!' as greeting`)
			.one();

		return { greeting: res.greeting };
	}
}

export default Do;
