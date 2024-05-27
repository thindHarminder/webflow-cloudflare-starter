//drizzle imports
import {
    drizzle
} from 'drizzle-orm/d1';
import * as schema from "../db/schema";
import {
    eq
} from "drizzle-orm";
import {
    users
} from "../db/schema";



export function zValidatorError(result: any) {

    const errors = result.error.errors.map((error: any) => {
        return {
            field: error.path.join("."),
            message: error.message,
        };
    });
    // cont error whew wqe use teh errors array to make a message, where we will say {field} field's error - {message}
    let errorMessage = errors.map((error: any) => {
        let message
        if (error.message !== "Required") {
            const newMessage = error.message.replace("String", error.field);
            // capitalize the first letter of the error message
            message = newMessage.charAt(0).toUpperCase() + newMessage.slice(1);
        }
        if (error.message === "Required") {

            const newMessage = `The ${error.field} field is required`;

            message = newMessage.charAt(0).toUpperCase() + newMessage.slice(1);
        }
        if (error.message == "Invalid") {
            message = "Password must contain minimum eight characters, at least one uppercase letter, one lowercase letter, one number and one special character from these #@$!%*?&"
        }
        console.log(message)
        return message;
    });

    return {
        errors,
        errorMessage
    };

}

export async function getCurrentUser(userId: string, d1: D1Database) {
    const db = drizzle(d1, {
        schema: {
            ...schema
        }
    })

    const usersList = await db.select({
        id: users.id,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
        profile_picture: users.profile_picture,
        email_verified: users.email_verified,
        todoPlan: users.todoPlan,
    }).from(users).where(eq(users.id, userId)).limit(1).execute();

    let foundUser = usersList[0];

    return foundUser;

}

export async function updateUser(userId: string, d1: D1Database, data: any) {
    const db = drizzle(d1, {
        schema: {
            ...schema
        }
    })

    try {
        await db.update(schema.users).set(data).where(eq(users.id, userId)).execute();
    } catch (error: any) {
        let errorMessage = "An error occurred";
        if (error.message.includes("users.email") && error.message.includes("UNIQUE")) {
            errorMessage = "Email already taken";
        }
        return {
            updateUser: null,
            error: errorMessage
        };
    }

    const updatedUser = await getCurrentUser(userId, d1);

    return {
        updateUser: updatedUser,
        error: null
    };

}

