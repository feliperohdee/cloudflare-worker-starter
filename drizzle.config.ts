import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'sqlite',
    driver: 'durable-sqlite',
    out: './drizzle',
    schema: './src/db/schema.ts'
});
