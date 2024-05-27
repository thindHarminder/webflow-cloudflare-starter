
import type { User, Session } from "lucia";

export  type UserRow = {
	email: string;
    id: string;
    first_name: string;
    email_verified: boolean;
    last_name: string | null;
    profile_picture: string | null;
    hashed_password: string;
    created_at: number;
    updated_at: number;
}

export type email_varification_codes_object = {
    id: string;
    user_id: string;
    code: string;
    expires_at: number;
}

export interface userObject extends User {
	email: string;
    id: string;
    first_name: string;
    email_verified: boolean;
    last_name: string | null;
    profile_picture: string | null;
    stripe_customer_id: string | null;
    created_at: number;
    updated_at: number;
}
export {User, Session};

export type Bindings = {
    PRODUCTION: boolean;
	DB: D1Database;
    R2: R2Bucket;
    WEBFLOW_DOMAIN : string;
    LOGIN_ROUTE : string;
    SECURED_ROUTES : string;
	SUCESSFUL_LOGIN_REDIRECT : string;
    EMAIL_VERIFICATION_ROUTE : string;
    SUCESSFUL_PAYMENT_REDIRECT : string;
    SETTINGS_ROUTE : string;
    MAILERSEND_KEY: string;
    STRIPE_KEY: string;
    RESET_PASSWORD_ROUTE : string;
    JS_SCRIPT_DOMAIN : string;
    MAIN_DOMAIN : string;
    API_LIMITER_ONCE: any;
    API_LIMITER_LARGE: any;
    API_LIMITER_REGULAR: any;
    API_LIMITER_SMALL: any;
    API_LIMITER_TINY: any;
    STRIPE_WEBHOOK_SECRET: string;
}