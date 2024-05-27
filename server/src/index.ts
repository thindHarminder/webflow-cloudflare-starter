import {
	Hono
} from "hono";
import {
	cors
} from 'hono/cors'
import {
	zValidator
} from "@hono/zod-validator";
import {
	Lucia
} from "lucia";
import {
	getCookie
} from "hono/cookie";
import {
	csrf
} from "hono/csrf";
import {
	D1Adapter
} from "@lucia-auth/adapter-sqlite";
import {
	generateIdFromEntropySize,
	Scrypt
} from "lucia";
import {
	Bindings,
	UserRow,
	User,
	userObject,
	Session
} from "./utils/types";

//drizzle imports
import {
	drizzle
} from 'drizzle-orm/d1';
import * as schema from "./db/schema";
import {
	users,
	password_reset_token
} from "./db/schema";
import {
	eq, and,
	max
} from "drizzle-orm";

//helpers
import {
	zValidatorError,
	updateUser,
} from "./utils/helper";

import {
	generateEmailVerificationCode,
	verifyVerificationCode,
	completeVerification,
	createPasswordResetToken,
	verifyPasswordResetToken
} from "./utils/auth";
import {
	sendOtp,
	sendEmail
} from "./utils/email";

// Todos helpers
import {newTodo, getTodos, updateTodo, deleteTodo, geneterateDummytodos, checkTodoLimit} from "./utils/todos";


//stripe helpers
import Stripe from 'stripe';

//validator schema
import {
	zValidatorSchema
} from "./utils/zodSchema";


//Variables
let user = null;


declare module "lucia" {
	interface Register {
		Auth: ReturnType < typeof initializeLucia > ;
		DatabaseUserAttributes: DatabaseUserAttributes;
	}
}

interface DatabaseUserAttributes {
	email: string;
	email_verified: number;
	first_name: string;
	last_name: string;
	profile_picture: string;
	todoPlan: string;
	reachedMaxTodo: number;
	stripe_customer_id: string;
	stripe_subscription_id: string;
	stripe_subscription_status: string;
}



// Start Hono App

const app = new Hono < {
	Bindings: Bindings;
	Variables: {
		user: User | null;
		session: Session | null;
	};
} > ();

//Impliment CORS

app.use(
	'*',
	cors({
		origin: 'https://REPLACE_WITH_YOUR_DOMAIN',
		allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
		maxAge: 600,
		credentials: true,
	}),
	csrf({
		origin: ['https://REPLACE_WITH_YOUR_DOMAINv'],
	})
)


//Set User and Session Variables

app.use("*", async (c, next) => {
	const lucia = initializeLucia(c.env.DB)
	const sessionId = getCookie(c, lucia.sessionCookieName) ?? null;
	if (!sessionId) {
		c.set("user", null);
		c.set("session", null);
		return next();
	}
	const {
		session,
		user
	} = await lucia.validateSession(sessionId);
	if (session && session.fresh) {
		// use `header()` instead of `setCookie()` to avoid TS errors
		c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), {
			append: true
		});
	}
	if (!session) {
		c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize(), {
			append: true
		});
	}
	c.set("user", user);
	c.set("session", session);
	return next();
});

//Initialize Lucia with D1Adapter

export function initializeLucia(D1: D1Database) {
	const adapter = new D1Adapter(D1, {
		user: "users",
		session: "sessions"
	});
	return new Lucia(adapter, {
		sessionCookie: {
			attributes: {
				secure: true,
			}
		},
		getUserAttributes: (attributes) => {
			return {
				email: attributes.email,
				email_verified: Boolean(attributes.email_verified),
				first_name: attributes.first_name,
				last_name: attributes.last_name,
				profile_picture: attributes.profile_picture,
				todoPlan: attributes.todoPlan,
				reachedMaxTodo: Boolean(attributes.reachedMaxTodo),
				stripe_customer_id: attributes.stripe_customer_id,
				stripe_subscription_id: attributes.stripe_subscription_id,
				stripe_subscription_status: attributes.stripe_subscription_status
			};
		}
	});
}


async function APIRATELIMIT(key: string, ratelimiter: any) {
	const {
		success
	} = await ratelimiter.limit({
		key: key
	})
	return success;

}

// Authantication Routes

app.post(
	"/signup",
	zValidator(
		"json", zValidatorSchema.signupSchema, async (result, context) => {
			if (!result.success) {
				const {
					errors,
					errorMessage
				} = zValidatorError(result);
				return context.json({
					success: false,
					errors,
					errorMessage
				}, 400);
			}

		}),
	async (c) => {

		const db = drizzle(c.env.DB, {
			schema: {
				...schema
			}
		})
		const data = await c.req.bodyCache.json;
		const {
			email,
			password,
			firstName,
			lastName,
			emailNewsletter
		} = data;
		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(email, c.env.API_LIMITER_TINY);
		console.log(rateLimiterStatus)
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "Too manu signup attempts, please try again later"
			}, 429);
		}
		const lucia = initializeLucia(c.env.DB);
		const scrypt = new Scrypt();
		const passwordHash = await scrypt.hash(password);
		const userId = generateIdFromEntropySize(10); // 16 characters long
		const currentTimestamp = Date.now();
		const avatarName = (firstName + '+' + lastName).replace(/\s/g, '+');
		const profile_picture = `https://ui-avatars.com/api/?name=${avatarName}&background=random&size=200&rounded=true`

		try {
			await db.insert(users).values({
				id: userId,
				email,
				first_name: firstName,
				last_name: lastName,
				email_verified: false,
				profile_picture,
				todoPlan: "0",
				hashed_password: passwordHash,
				created_at: currentTimestamp,
				updated_at: currentTimestamp,
				stripe_subscription_status: "Free",
				email_newsletter: Boolean(emailNewsletter) || false
			})
			const code = await generateEmailVerificationCode(c.env.DB, userId);

			// send email here
			await sendOtp('otp@email.thind.dev', email, firstName, code, 'Email Verification', c.env.MAILERSEND_KEY);

			const session = await lucia.createSession(userId, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			c.header("Set-Cookie", sessionCookie.serialize(), {
				append: true,
			});
			return c.json({
				success: true
			});
		} catch (error: any) {
			// db error, email taken, etc
			let errorMessage = "An error occurred";
			if (error.message.includes("users.email") && error.message.includes("UNIQUE")) {
				errorMessage = "Email already taken";
			}
			return new Response(String(errorMessage), {
				status: 400
			});
		}
	}
);

app.post(
	"/login",
	zValidator(
		"json", zValidatorSchema.loginSchema, (result, c) => {
			if (!result.success) {
				const {
					errors,
					errorMessage
				} = zValidatorError(result);
				return c.json({
					success: false,
					errors,
					errorMessage
				}, 400);
			}
		}),
	async (c) => {
		const db = drizzle(c.env.DB, {
			schema: {
				...schema
			}
		})
		const data = await c.req.bodyCache.json;
		const {
			email,
			password
		} = data;
		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(email, c.env.API_LIMITER_TINY);
		console.log(rateLimiterStatus)
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "Too manu login attempts, please try again later"
			}, 429);
		}
		const lucia = initializeLucia(c.env.DB);
		let usersList = await db.select().from(users).where(eq(users.email, email)).limit(1).execute() as UserRow[];
		user = usersList[0];
		const scrypt = new Scrypt();
		let passwordHash: string | undefined;
		if (user) {
			passwordHash = user.hashed_password;
		} else {
			passwordHash = "ksdfsjduewiuhfieyghwf8843929084032d"; //random string to prevent timing attacks
		}
		const passwordMatch = await scrypt.verify(passwordHash, password);
		if (!user || passwordMatch === false) {
			return c.json({
				success: false,
				errorMessage: "Invalid email or password"
			}, 400);
		}
		const session = await lucia.createSession(user.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		c.header("Set-Cookie", sessionCookie.serialize(), {
			append: true
		});
		return c.json({
			success: true
		});
	}
);

app.post(
	"/verify-email",
	zValidator(
		"json", zValidatorSchema.emailVerificationSchema, (result, c) => {
			if (!result.success) {
				const {
					errors,
					errorMessage
				} = zValidatorError(result);
				return c.json({
					success: false,
					errors,
					errorMessage
				}, 400);
			}
		}),
	async (c) => {
		user = c.get("user") as userObject;
		if (!user) {
			return c.json({
				success: false,
				errorMessage: "No user found"
			}, 400);
		}
		const data = await c.req.bodyCache.json;
		const {
			code
		} = data;

		const vaildCode = await verifyVerificationCode(c.env.DB, user, code);
		if (!vaildCode) {
			return c.json({
				success: false,
				errorMessage: "Invalid or Expired Code"
			}, 400);
		}

		const lucia = initializeLucia(c.env.DB);

		await lucia.invalidateUserSessions(user.id);
		try{await completeVerification(c.env.DB, user);}
		catch(e){
			return c.json({
				success: false,
				errorMessage: "An error occurred while verifying email"
			}, 400);
		}



		const session = await lucia.createSession(user.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		c.header("Set-Cookie", sessionCookie.serialize(), {
			append: true
		});

		return c.json({
			success: true
		});
	}
);

app.post("/resend-verification", async (c) => {
	user = c.get("user") as userObject;
	if (!user) {
		return c.json({
			success: false,
			errorMessage: "No user found"
		}, 400);
	}
	//Rate Limiter
	const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_ONCE);
	if (!rateLimiterStatus) {
		return c.json({
			success: false,
			errorMessage: "You can only request a verification email every 1 minutes"
		}, 429);
	}

	const code = await generateEmailVerificationCode(c.env.DB, user.id);
	await sendOtp('otp@email.thind.dev', user.email, user.first_name, code, 'Email Verification', c.env.MAILERSEND_KEY);
	return c.json({
		success: true
	});
});


app.post("/logout", async (c) => {
	const lucia = initializeLucia(c.env.DB);
	const sessionId = getCookie(c, lucia.sessionCookieName);
	if (!sessionId) {
		return c.json({
			success: false,
			errorMessage: "No session found"
		}, 400);
	}
	const session = await lucia.validateSession(sessionId);
	if (!session) {
		return c.json({
			success: false,
			errorMessage: "No session found"
		}, 400);
	}
	await lucia.invalidateSession(sessionId);
	c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize(), {
		append: true
	});


	return c.json({
		success: true
	});
});

app.get("/self", async (c) => {
	let user = c.get("user") as userObject;
	if (!user) {
		return c.json({
			success: false,
			errorMessage: "Unauthorized"
		}, 401);
	}
	//Rate Limiter
	const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_REGULAR);
	if (!rateLimiterStatus) {
		return c.json({
			success: false,
			errorMessage: "Too many requests"
		}, 429);
	}
	const actionCheckTodoLimit = await checkTodoLimit(user.id, c.env.DB);
	const reachedMaxTodo = actionCheckTodoLimit.limitReached;
	const limit = actionCheckTodoLimit.limit;
	const userWithLimit  = {
		...user,
		reachedMaxTodo,
		limit,
	}

	return c.json({
		success: true,
		user: userWithLimit
	});
});

app.post(
	"/recover-password",
	zValidator(
		"json", zValidatorSchema.recoverPasswordSchema, async (result, context) => {
			if (!result.success) {
				const {
					errors,
					errorMessage
				} = zValidatorError(result);
				return context.json({
					success: false,
					errors,
					errorMessage
				}, 400);
			}

		}),
	async (c) => {
		const db = drizzle(c.env.DB, {
			schema: {
				...schema
			}
		})
		const data = await c.req.bodyCache.json;
		const {
			email
		} = data;

		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(email, c.env.API_LIMITER_ONCE);
		console.log(rateLimiterStatus)
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "You can only request a password reset email every 1 minute"
			}, 429);
		}

		let selectedUserList = await db.select().from(users).where(eq(users.email, email)).execute() as UserRow[];
		let selectedUser = selectedUserList[0] as UserRow;

		if (selectedUser) {
			const verificationToken = await createPasswordResetToken(c.env.DB, selectedUser.id);
			let emailDomain = c.env.MAIN_DOMAIN
			let url = `${c.env.MAIN_DOMAIN}/${c.env.RESET_PASSWORD_ROUTE}?token=${verificationToken}`;
			// send email here
			await sendEmail("account@email.thind.dev", email, selectedUser.first_name, "Password Reset - Thind.dev", "Password Reset Link", "You have requested a password reset. Click the button below to reset your password.", url, "Reset Password", c.env.MAILERSEND_KEY);
		}


		return c.json({
			success: true
		});
	});

app.post(
	"/reset-password",
	zValidator(
		"json", zValidatorSchema.resetPasswordSchema, async (result, context) => {
			if (!result.success) {
				const {
					errors,
					errorMessage
				} = zValidatorError(result);
				return context.json({
					success: false,
					errors,
					errorMessage
				}, 400);
			}

		}),
	async (c) => {



		const db = drizzle(c.env.DB, {
			schema: {
				...schema
			}
		})

		const data = await c.req.bodyCache.json;
		const {
			token,
			password,
			confirmPassword
		} = data;

		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(token, c.env.API_LIMITER_TINY);
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "Too many requests"
			}, 429);
		}

		if (password !== confirmPassword) {
			return c.json({
				success: false,
				errorMessage: "Passwords do not match"
			}, 400);
		}


		const {
			valid,
			foundToken
		} = await verifyPasswordResetToken(c.env.DB, token);
		if (!valid) {
			return c.json({
				success: false,
				errorMessage: "Invalid or Expired Token"
			}, 400);
		}
		const lucia = initializeLucia(c.env.DB);
		await lucia.invalidateUserSessions(foundToken.user_id);
		const scrypt = new Scrypt();
		const passwordHash = await scrypt.hash(password);

		await db.update(users).set({
			hashed_password: passwordHash
		}).where(eq(users.id, foundToken.user_id)).execute();

		const session = await lucia.createSession(foundToken.user_id, {});
		await db.delete(password_reset_token).where(eq(password_reset_token.user_id, foundToken.user_id)).execute();
		const sessionCookie = lucia.createSessionCookie(session.id);
		c.header("Set-Cookie", sessionCookie.serialize(), {
			append: true
		});
		return c.json({
			success: true
		});

	}
);

//Assets routes
app.post("/profile-picture",
	async (c) => {
		const user = c.get("user") as userObject;
		if (!user) {
			return c.json({
				success: false,
				errorMessage: "Unauthorized"
			}, 401);
		}
		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_TINY);
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "Too many requests"
			}, 429);
		}
		const body = await c.req.parseBody({
			all: true
		});
		const file = body["file"] as File; // Cast 'file' to type 'File'
		if (!file) {
			return c.json({
				success: false,
				errorMessage: "No file found, make sure you include file input in your request"
			}, 400);
		}
		const fileType = file.type;
		const fileSize = file.size;
		if (fileSize > 1000000) {
			return c.json({
				success: false,
				errorMessage: "File size is too large, max file size is 1MB"
			}, 400);
		}
		if (!["image/jpeg", "image/jpg", "image/png"].includes(fileType)) {
			return c.json({
				success: false,
				errorMessage: "Invalid file type. We only accept jpeg, jpg, png, webp files"
			}, 400);
		}
		await c.env.R2.put(`assets/${user.id}/${file.name}`, file);
		const db = drizzle(c.env.DB, {
			schema: {
				...schema
			}
		})
		const url = `/assets/${user.id}/${file.name}`;

		const action = await updateUser(user.id, c.env.DB, {
			profile_picture: url
		});
		if (action.error) {
			return c.json({
				success: false,
				errorMessage: action.error
			}, 400);
		}

		return c.json({
			success: true,
			user: action.updateUser
		});
	});

app.get("/assets/:userId/:fileName", async (c) => {
	const user = c.get("user") as userObject;
	if (!user) {
		return c.json({
			success: false,
			errorMessage: "Unauthorized"
		}, 401);
	}
	//Rate Limiter
	const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_REGULAR);
	if (!rateLimiterStatus) {
		return c.json({
			success: false,
			errorMessage: "Too many requests"
		}, 429);
	}
	const {
		userId,
		fileName
	} = c.req.param();
	if (userId !== user.id) {
		return c.json({
			success: false,
			errorMessage: "Unauthorized"
		}, 401);
	}
	const file = await c.env.R2.get(`assets/${userId}/${fileName}`);
	if (!file) {
		return c.json({
			success: false,
			errorMessage: "File not found"
		}, 404);
	}
	const headers = new Headers();
	file.writeHttpMetadata(headers);
	headers.set('etag', file.httpEtag);
	return new Response(file.body, {
		headers
	});
});


//user settings
app.put(
	"/user",
	zValidator(
		"json", zValidatorSchema.updateUserSettingsSchema, async (result, context) => {
			if (!result.success) {
				const {
					errors,
					errorMessage
				} = zValidatorError(result);
				return context.json({
					success: false,
					errors,
					errorMessage
				}, 400);
			}

		}),
	async (c) => {
		const db = drizzle(c.env.DB, {
			schema: {
				...schema
			}
		})
		const user = c.get("user") as UserRow;
		if (!user) {
			return c.json({
				success: false,
				errorMessage: "Unauthorized"
			}, 401);
		}
		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_TINY);
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "Too many requests"
			}, 429);
		}
		const data = await c.req.bodyCache.json;
		const {
			first_name,
			last_name,
			profile_picture,
			email,
			password,
			newPassword
		} = data;
		if (email && !password) {
			return c.json({
				success: false,
				errorMessage: "Current password is required to change email"
			}, 401);

		}
		if (newPassword && !password) {
			return c.json({
				success: false,
				errorMessage: "Current password is required to change password"
			}, 401);
		}

		if (password) {
			let usersList = await db.select().from(users).where(eq(users.id, user.id)).limit(1).execute() as UserRow[];
			const useFound = usersList[0];
			const scrypt = new Scrypt();
			let passwordHash = useFound.hashed_password;
			if (!passwordHash) {
				return c.json({
					success: false,
					errorMessage: "Invalid password"
				}, 401);
			}

			const passwordMatch = await scrypt.verify(passwordHash, password);
			if (passwordMatch === false) {
				return c.json({
					success: false,
					errorMessage: "Invalid password"
				}, 401);
			}
		}

		const currentTimestamp = Date.now();
		const updateData: Partial < UserRow > = {
			updated_at: currentTimestamp
		};

		if (newPassword) {
			const lucia = initializeLucia(c.env.DB);
			const scrypt = new Scrypt();
			let passwordHash = await scrypt.hash(newPassword);
			updateData.hashed_password = passwordHash;

			//invalidate all sessions
			await lucia.invalidateUserSessions(user.id);
			//create new session
			const session = await lucia.createSession(user.id, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			c.header("Set-Cookie", sessionCookie.serialize(), {
				append: true
			});
		}



		if (first_name) {
			updateData.first_name = first_name;
		}

		if (last_name) {
			updateData.last_name = last_name;
		}

		if (profile_picture) {
			updateData.profile_picture = profile_picture;
		}

		if (email) {
			updateData.email = email;
		}


		const action = await updateUser(user.id, c.env.DB, updateData);

		if (action.error) {
			return c.json({
				success: false,
				errorMessage: action.error
			}, 400);
		}


		return c.json({
			success: true,
			user: action.updateUser
		});
	}
);


//TODOS API ROUTES
app.get("/todos", async (c) => {
	const user = c.get("user") as userObject;
	if (!user) {
		return c.json({
			success: false,
			errorMessage: "Unauthorized"
		}, 401);
	}
	//Rate Limiter
	const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_LARGE);
	if (!rateLimiterStatus) {
		return c.json({
			success: false,
			errorMessage: "Too many requests"
		}, 429);
	}
	const todos = await getTodos(user.id, c.env.DB);

	return c.json({
		success: true,
		todos
	});
});

app.post("/todos/dummy", async (c) => {
	const user = c.get("user") as userObject;
	if (!user) {
		return c.json({
			success: false,
			errorMessage: "Unauthorized"
		}, 401);
	}
	//Rate Limiter
	const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_SMALL);
	if (!rateLimiterStatus) {
		return c.json({
			success: false,
			errorMessage: "Too many requests"
		}, 429);
	}
	//check if user has reached the todo limit
	const actionCheckTodoLimit = await checkTodoLimit(user.id, c.env.DB);
	const todoLimit = actionCheckTodoLimit.limitReached;
	if (todoLimit) {
		return c.json({
			success: false,
			maxTodoLimit: true,
			errorMessage: "You have reached the maximum todo limit"
		}, 400);
	}
	try{
		const dummyTodosAction = await geneterateDummytodos(user.id, c.env.DB);
		if (dummyTodosAction.error) {
			return c.json({
				success: false,
				errorMessage: dummyTodosAction.error
			}, 400);
		} else if (dummyTodosAction.todos) {
			return c.json({
				success: true,
				todos: dummyTodosAction.todos
			});
		}
	}
	catch(error){
		return c.json({
			success: false,
			errorMessage: "An error occurred"
		}, 400);
	}

});
	

app.post("/todos",
	zValidator(
		"json", zValidatorSchema.todosSchema, async (result, context) => {
			if (!result.success) {
				const {
					errors,
					errorMessage
				} = zValidatorError(result);
				return context.json({
					success: false,
					errors,
					errorMessage
				}, 400);
			}
		}),
	async (c) => {
		const user = c.get("user") as userObject;
		if (!user) {
			return c.json({
				success: false,
				errorMessage: "Unauthorized"
			}, 401);
		}
		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_SMALL);
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "Too many requests"
			}, 429);
		}
	//check if user has reached the todo limit
	const actionCheckTodoLimit = await checkTodoLimit(user.id, c.env.DB);
	const todoLimit = actionCheckTodoLimit.limitReached;
	if (todoLimit) {
		return c.json({
			success: false,
			maxTodoLimit: true,
			errorMessage: "You have reached the maximum todo limit"
		}, 400);
	}
		const db = drizzle(c.env.DB, {
			schema: {
				...schema
			}
		})
		const data = await c.req.bodyCache.json;
		const {
			title,
			description,
			due_date
		} = data;

		try{
			const action =  await newTodo(user.id, c.env.DB, {title, description, due_date} as typeof schema.todos);
			if (action.error) {
				return c.json({
					success: false,
					errorMessage: action.error
				}, 400);
			} else if (action.todo){
				return c.json({
					success: true,
					todo : action.todo[0]
				});
		}
	}
		catch(error){
			return c.json({
				success: false,
				errorMessage: "An error occurred"
			}, 400);
		}

	});

	app.patch("/todos/bulk", 
	zValidator(
		"json", zValidatorSchema.todosBulkSchema, async (result, context) => {
			if (!result.success) {
				const {
					errors,
					errorMessage
				} = zValidatorError(result);
				return context.json({
					success: false,
					errors,
					errorMessage
				}, 400);
			}
		}),
		async (c) => {
		const user = c.get("user") as userObject;
		if (!user) {
			return c.json({
				success: false,
				errorMessage: "Unauthorized"
			}, 401);
		}
		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_REGULAR);
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "Too many requests"
			}, 429);
		}
		const db = drizzle(c.env.DB, {
			schema: {
				...schema
			}
		})
		const data = await c.req.bodyCache.json;
		const todos = data;
		for (let i = 0; i < todos.length; i++) {
			const todo = todos[i];
			try{
				const action = await updateTodo(todo.id, c.env.DB, todo );
				if (action.error) {
					return c.json({
						success: false,
						errorMessage: action.error
					}, 400);
				} 
			}
			catch(error){
				return c.json({
					success: false,
					errorMessage: "An error occurred"
				}, 400);
			}
				
		}
		return c.json({
			success: true,
			todos: await getTodos(user.id, c.env.DB)
		});
	}
	);

	app.patch("/todos/:id",
	zValidator(
		"json", zValidatorSchema.todosSchema, async (result, context) => {
			if (!result.success) {
				const {
					errors,
					errorMessage
				} = zValidatorError(result);
				return context.json({
					success: false,
					errors,
					errorMessage
				}, 400);
			}
		}),
	async (c) => {
		const user = c.get("user") as userObject;
		if (!user) {
			return c.json({
				success: false,
				errorMessage: "Unauthorized"
			}, 401);
		}
		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_REGULAR);
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "Too many requests"
			}, 429);
		}
		const {
			id 
		} = c.req.param();
		const data = await c.req.bodyCache.json as typeof schema.todos;

		try{
		const action = await updateTodo(id, c.env.DB, data );
		if (action.error) {
			return c.json({
				success: false,
				errorMessage: action.error,
			}, 400);
		} else {
			return c.json({
				success: true,
				todo : action.todo
			});
		}
		}
		catch(error){
			return c.json({
				success: false,
				errorMessage: "An error occurred"
			}, 400);
		}
	});

	app.delete("/todos/:id", async (c) => {
		const user = c.get("user") as userObject;
		if (!user) {
			return c.json({
				success: false,
				errorMessage: "Unauthorized"
			}, 401);
		}
		//Rate Limiter
		const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_REGULAR);
		if (!rateLimiterStatus) {
			return c.json({
				success: false,
				errorMessage: "Too many requests"
			}, 429);
		}
		const {
			id 
		} = c.req.param();
		const db = drizzle(c.env.DB, {
			schema: {
				...schema
			}
		})
		try{
		await deleteTodo(id, c.env.DB, user.id); 
		return c.json({
			success: true
		});
		}
		catch(error){
			return c.json({
				success: false,
				errorMessage: "An error occurred"
			}, 400);
		}
	});

//Payment & Plans Endpoints

app.get("/plans", async (c) => {
	const user = c.get("user") as userObject;
	if (!user) {
		return c.json({
			success: false,
			errorMessage: "Unauthorized"
		}, 401);
	}
	//Rate Limiter
	const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_REGULAR);
	if (!rateLimiterStatus) {
		return c.json({
			success: false,
			errorMessage: "Too many requests"
		}, 429);
	}
	const db = drizzle(c.env.DB, {
		schema: {
			...schema
		}
	})
	const plans = await db.select().from(schema.todoPlans).where(eq(schema.todoPlans.active, true)).execute();
	return c.json({
		plans: plans
	});
});

app.get("/create-checkout-session/:id", async (c) => {
	const user = c.get("user") as userObject;
	if (!user) {
		return c.json({
			success: false,
			errorMessage: "Unauthorized"
		}, 401);
	}
	//Rate Limiter
	const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_SMALL);
	if (!rateLimiterStatus) {
		return c.json({
			success: false,
			errorMessage: "Too many requests"
		}, 429);
	}
	const {
		id
	} = c.req.param();
	const db = drizzle(c.env.DB, {
		schema: {
			...schema
		}
	})
	let plan = await db.select().from(schema.todoPlans).where(eq(schema.todoPlans.id, id)).limit(1);
	const line_items = [
		{
		  price: plan[0].stripe_price_id,
		  quantity: 1,
		},
	  ];
	  let requestBody = {
		ui_mode: 'embedded',
		line_items,
		client_reference_id: user.id,
		mode: 'subscription',
		return_url: `${c.env.MAIN_DOMAIN}${c.env.SUCESSFUL_PAYMENT_REDIRECT}?session_id={CHECKOUT_SESSION_ID}`,
		automatic_tax: {enabled: true},
	  } as Stripe.Checkout.SessionCreateParams;
	  console.log(user.stripe_customer_id);
	  if (user.stripe_customer_id){
		requestBody = {
			...requestBody,
			customer: user.stripe_customer_id,
		}
	  } else {
		requestBody = {
			...requestBody,
			customer_email: user.email,
	  }
	}
		
	  
	  const stripe = new Stripe(c.env.STRIPE_KEY);
	  try {const session  =await stripe.checkout.sessions.create(
		requestBody
	  );
	  return c.json({
		success : true,
		client_secret: session.client_secret
	  });
	  } catch (error: any) {
		  console.log(error);
		  return c.json({
			success : false,
			errorMessage: "An error occurred"
		  });
	  }
	  
});

app.get("/check-payment-status/:id", async (c) => {
	const user = c.get("user") as userObject;
	if (!user) {
		return c.json({
			success: false,
			errorMessage: "Unauthorized"
		}, 401);
	}
	//Rate Limiter
	const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_SMALL);
	if (!rateLimiterStatus) {
		return c.json({
			success: false,
			errorMessage: "Too many requests"
		}, 429);
	}
	const {
		id
	} = c.req.param();
	const stripe = new Stripe(c.env.STRIPE_KEY);
	try {
		const session = await stripe.checkout.sessions.retrieve(id);
		return c.json({
			status: session.status
		});
	} catch (error: any) {
		console.log(error);
		return c.json({
			errorMessage: "An error occurred"
		});
	}
});

app.get("/stripe-portal", async (c) => {
	const user = c.get("user") as userObject;
	if (!user) {
		return c.json({
			success: false,
			errorMessage: "Unauthorized"
		}, 401);
	}
	//Rate Limiter
	const rateLimiterStatus = await APIRATELIMIT(user.id, c.env.API_LIMITER_SMALL);
	if (!rateLimiterStatus) {
		return c.json({
			success: false,
			errorMessage: "Too many requests"
		}, 429);
	}
	const db = drizzle(c.env.DB, {
		schema: {
			...schema
		}
	})
	let session = null;
	if (user.stripe_customer_id) {
		const stripe = new Stripe(c.env.STRIPE_KEY);
		session = await stripe.billingPortal.sessions.create({
			customer: user.stripe_customer_id,
			return_url: `${c.env.MAIN_DOMAIN}${c.env.SETTINGS_ROUTE}`,
		  });
		if (session.url) {
			return c.json({
				success: true,
				url: session.url
			});
		} else 
		{
			return c.json({
				success: false,
				errorMessage: "An error occurred while connecting to stripe"
			}, 400);
		}
	}
	
});

//Webhooks

app.post("/stripe-webhooks", async (c) => {
	const db = drizzle(c.env.DB, {
		schema: {
			...schema
		}
	});
	const stripe = new Stripe(c.env.STRIPE_KEY);
	const sig = c.req.header('Stripe-Signature') as string;
	const body = await c.req.text();
	let event: Stripe.Event;
	try {
		event = await stripe.webhooks.constructEventAsync( body, sig , c.env.STRIPE_WEBHOOK_SECRET);
	} catch (error: any) {
		return c.json({
			success: false,
			errorMessage: `Webhook Error: ${error.message}`
		}, 400);
	}
	switch (event.type) {
		case 'customer.created':
			const customerCreated = event.data.object as Stripe.Customer;
			if (customerCreated.email) {
				try{
					let createdUser = await db.select().from(schema.users).where(eq(schema.users.email, customerCreated.email)).limit(1).execute();
					if (createdUser.length > 0) {
						await updateUser(createdUser[0].id, c.env.DB, {
							stripe_customer_id: customerCreated.id
						});
					}
				}
				catch(error){
					return c.json({
						success: false,
						errorMessage: "An error occurred"
					}, 400);
				}
			} else {
				console.log("No email found in customer object, cannot update user");
				return c.json({
					success: false,
					errorMessage: "No email found in customer object, cannot update user"
				}, 400);
			}
			break;

		// Handle Subscription Events
		case 'customer.subscription.created':
			const customerSubscriptionCreated = event.data.object as Stripe.Subscription;
			const customerId = customerSubscriptionCreated.customer as string;
			let customer = await db.select().from(schema.users).where(eq(schema.users.stripe_customer_id, customerId)).limit(1).execute();
			if (customer.length > 0) {
				await updateUser(customer[0].id, c.env.DB, {
					todoPlan: customerSubscriptionCreated.items.data[0].price.product as string,
					stripe_subscription_id: customerSubscriptionCreated.id,
					stripe_subscription_status: customerSubscriptionCreated.status
				});
			}
		break;
		case 'customer.subscription.updated':
			console.log("Subscription Updated");
			const customerSubscriptionUpdated = event.data.object as Stripe.Subscription;
			const customerIdUpdated = customerSubscriptionUpdated.customer as string;
			let customerUpdated = await db.select().from(schema.users).where(eq(schema.users.stripe_customer_id, customerIdUpdated)).limit(1).execute();
			if (customerUpdated.length > 0) {
				await updateUser(customerUpdated[0].id, c.env.DB, {
					todoPlan: customerSubscriptionUpdated.items.data[0].price.product as string,
					stripe_subscription_id: customerSubscriptionUpdated.id,
					stripe_subscription_status: customerSubscriptionUpdated.status
				});
			}
		break;
		case 'customer.subscription.deleted':
			const customerSubscriptionDeleted = event.data.object as Stripe.Subscription;
			const customerIdDeleted = customerSubscriptionDeleted.customer as string;
			let customerDeleted = await db.select().from(schema.users).where(eq(schema.users.stripe_customer_id, customerIdDeleted)).limit(1).execute();
			if (customerDeleted.length > 0) {
				await updateUser(customerDeleted[0].id, c.env.DB, {
					todoPlan: "0",
					stripe_subscription_id: null,
					stripe_subscription_status: "canceled"
				});
			}
		break;
		default:
			console.log(`Unhandled event type ${event.type}`);
	}
	return c.json({
		success: true
	});
});


// Webflow Proxy

app.get("*", async (c): Promise < void | Response > => {
	user = c.get("user") as userObject;
	const {
		origin,
		hostname,
		pathname,
		search
	} = new URL(c.req.url)
	let fetchurl = `${c.env.WEBFLOW_DOMAIN}${pathname}${search}`
	const folderName = pathname.split('/')[1]
	const pageName = pathname.split('/').pop();
	const securedRoutes = c.env.SECURED_ROUTES.split(',');
	if (securedRoutes.includes(folderName) && !user) {
		return c.redirect(c.env.LOGIN_ROUTE + '?message=This page is secured, please login to continue&errorType=error')
	}
	if (pageName === 'login' && user) {
		return c.redirect(c.env.SUCESSFUL_LOGIN_REDIRECT + '?message=You are already logged in')
	}
	if (securedRoutes.includes(folderName) && user && !user.email_verified) {
		return c.redirect(c.env.EMAIL_VERIFICATION_ROUTE + '?message=Please verify your email to continue')
	}

	// append a script tag in head of html

	let data = await fetch(fetchurl) as any;
	// if content is html, append script tag
	if (data.headers.get('content-type')?.includes('text/html')) {
		const html = await data.text();
		let newHtml = html.replace('</head>', `<script defer type="module" src="${c.env.JS_SCRIPT_DOMAIN}/index.js"></script></head>`);
		if (pageName !== "") {
			newHtml = newHtml.replace('</head>', `<script defer type="module" src="${c.env.JS_SCRIPT_DOMAIN}/client/pages/${pageName}.js"></script></head>`);
		}
		data = new Response(newHtml, {
			headers: data.headers
		});

	}
	const headers = c.req.header();
	const newResponse = new Response(data.body as BodyInit, {
		headers
	});

	return newResponse;

});



export default app;