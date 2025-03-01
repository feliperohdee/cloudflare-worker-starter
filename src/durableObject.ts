import { drizzle, DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { DurableObject } from 'cloudflare:workers';
import { migrate } from 'drizzle-orm/durable-sqlite/migrator';
import { sql } from 'drizzle-orm';
import migrations from '../drizzle/migrations';
import * as schema from './db/schema';

class Do extends DurableObject<Env> {
	public ctx: DurableObjectState;
	public db: DrizzleSqliteDODatabase<typeof schema>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.ctx = ctx;
		this.db = drizzle(ctx.storage, {
			logger: !false,
			schema
		});

		ctx.blockConcurrencyWhile(async () => {
			await migrate(this.db, migrations);
		});
	}

	async insertAndList(user: typeof schema.usersTable.$inferInsert) {
		await this.insert(user);
		return this.select();
	}

	async insert(user: typeof schema.usersTable.$inferInsert) {
		return this.db.insert(schema.usersTable).values(user).returning({
			id: schema.usersTable.id
		});
	}

	async insertPost(post: typeof schema.postsTable.$inferInsert) {
		return this.db.insert(schema.postsTable).values(post).returning();
	}

	async insertPostWithTransaction() {
		try {
			// Aguarda a transação completar totalmente
			const res = await this.db.transaction(async tx => {
				const user = await tx
					.insert(schema.usersTable)
					.values({
						email: 'test@test.com',
						name: 'Test User',
						age: 20
					})
					.returning({
						id: schema.usersTable.id
					});

				const post = await tx
					.insert(schema.postsTable)
					.values({
						title: 'Test Post',
						userId: user[0].id
					})
					.returning();

				tx.rollback();

				const result = { post, user };
				console.log('Dentro da transação:', result);
				return result;
			}, {
				behavior: 'immediate'
			});

			// Só executa após a transação terminar
			console.log('Após a transação:', { res });
			return res;
		} catch (error) {
			console.error('Erro na transação:', error);
			throw error;
		}
	}

	async getWithRelations() {
		return this.db.query.usersTable.findMany({
			with: {
				posts: true
			}
		});
	}

	async select() {
		return this.db.select().from(schema.usersTable);
	}

	async sayHello() {
		let res = this.ctx.storage.sql
			.exec(`SELECT 'Hello, World!' as greeting`)
			.one();

		return { greeting: res.greeting };
	}
}

export default Do;
