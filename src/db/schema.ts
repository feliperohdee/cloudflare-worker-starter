import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

const usersTable = sqliteTable('users_table', {
    id: text().$defaultFn(() => {
		return crypto.randomUUID();
	}).primaryKey(),
    age: int().notNull(),
    email: text().notNull().unique(),
    name: text().notNull()
});

const postsTable = sqliteTable('posts_table', {
    id: text().$defaultFn(() => crypto.randomUUID()).primaryKey(),
    title: text().notNull(),
    userId: text().notNull().references(() => {
		return usersTable.id
	}, {
		onDelete: 'cascade'
	})
});

const usersPostsRelations = relations(usersTable, ({ many }) => ({
	posts: many(postsTable)
}));

const postsUsersRelations = relations(postsTable, ({ one }) => ({
	user: one(usersTable, {
		fields: [postsTable.userId],
		references: [usersTable.id]
	})
}));

export { usersTable, postsTable, postsUsersRelations, usersPostsRelations };
