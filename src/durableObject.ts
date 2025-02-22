import { DurableObject } from 'cloudflare:workers';

class Do extends DurableObject<Env> {
	public ctx: DurableObjectState;

	constructor(ctx: DurableObjectState, env: Env) {
		// Required, as we're extending the base class.
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
