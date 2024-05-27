import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';


export const users = sqliteTable('users', {
    id: text("id").primaryKey(),
    email: text("email").unique().notNull(),
    first_name: text("first_name").notNull(),
    last_name: text("last_name"),
    profile_picture: text("profile_picture"),
    email_verified: integer("email_verified", {mode: "boolean"}),
    hashed_password: text("hashed_password").notNull(),
    todoPlan: text("todoPlan"),
    stripe_customer_id: text("stripe_customer_id"),
    stripe_subscription_id: text("stripe_subscription_id"),
    stripe_subscription_status: text("stripe_subscription_status"),
    email_newsletter: integer("email_newsletter", {mode: "boolean"}),
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull(),
});

export const sessions = sqliteTable('sessions', {
    id: text("id").primaryKey().notNull(),
    user_id: text("user_id").notNull(),
    expires_at: integer("expires_at").notNull(),
});

export const email_varification_codes = sqliteTable('email_varification_codes', {
    id: text("id").primaryKey().notNull(),
    user_id: text("user_id").unique(),
    code: text("code"),
    expires_at: integer("expires_at"),
});

export const password_reset_token = sqliteTable('password_reset_token', {
    user_id: text("user_id").unique().primaryKey().notNull(),
    token_hash: text("code").unique().notNull(),
    expires_at: integer("expires_at"),
});

export const todos = sqliteTable('todos', {
    id: text("id").primaryKey(),
    user_id: text("user_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    index: integer("index").notNull(),
    completed: integer("completed", {mode: "boolean"}),
    created_at: integer("created_at").notNull(),
    due_date: integer("due_date").notNull(),
});


export const todoPlans = sqliteTable('todoPlans', {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    description: text("description"),
    todolimit: integer("todolimit"),
    interval: text("interval"),
    features: text('features', { mode: 'json' }),
    active: integer("active", {mode: "boolean"}).notNull(),
    stripe_price_id: text("stripe_price_id").notNull()
});

