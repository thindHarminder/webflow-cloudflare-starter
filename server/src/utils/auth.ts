import { generateRandomString, alphabet, sha256 } from "oslo/crypto";
import { TimeSpan, createDate } from "oslo";
import { encodeHex } from "oslo/encoding";
import { generateIdFromEntropySize } from "lucia";

//drizzle imports
import {drizzle}  from 'drizzle-orm/d1';
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { users, email_varification_codes, sessions, password_reset_token } from "../db/schema";
import { User, email_varification_codes_object } from "./types";

export async function generateEmailVerificationCode(d1:D1Database,userId: string): Promise<string> {
    const db = drizzle(d1, { schema: { ...schema} } )
    await db.delete(email_varification_codes).where(eq(email_varification_codes.user_id, userId)).execute();
	const code = generateRandomString(6, alphabet("0-9"));
    await db.insert(email_varification_codes).values({
        id: userId,
        user_id: userId,
        code,
        expires_at: Date.now() + (15 * 60 * 1000) 
    });



	return code;
}

export async function verifyVerificationCode(d1:D1Database,user: User, code: string): Promise<boolean> {
    console.log("start verification");
    const db = drizzle(d1, { schema: { ...schema} } )
    let selectedUser = await db.select().from(users).where(eq(users.id, user.id)).execute();
    let verificationCodeList = await db.select().from(email_varification_codes).where(eq(email_varification_codes.user_id, user.id)).execute() as email_varification_codes_object[];  
    const verificationCode = verificationCodeList[0] ;
    if (!selectedUser || !verificationCode) {
        return false;
    }
    const isCodeValid = verificationCode.expires_at as number > Date.now() && verificationCode.code === code;
    if (!isCodeValid) {
        return false;
    }
	return true;
}

export async function completeVerification(d1:D1Database,user: User): Promise<void> {
    console.log("completing verification");
    
    const db = drizzle(d1, { schema: { ...schema} } )
   try { await db.update(users).set({
        email_verified: true
    }).where(eq(users.id, user.id)).execute();}
    catch(e) {
        console.log(e)
    }
}

export async function createPasswordResetToken(d1:D1Database,userId: string): Promise<string> {
	// optionally invalidate all existing tokens
    const db = drizzle(d1, { schema: { ...schema} } )
    await db.delete(password_reset_token).where(eq(password_reset_token.user_id, userId)).execute();
	const tokenId = generateIdFromEntropySize(25); // 40 character
	const tokenHash = encodeHex(await sha256(new TextEncoder().encode(tokenId)));
    await db.insert(password_reset_token).values({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: Date.now() + (60 * 60 * 1000) 
    }); 
	return tokenId;
}

export async function verifyPasswordResetToken(d1:D1Database, tokenInput:string): Promise<{ valid: boolean, foundToken: any }> {
	// optionally invalidate all existing tokens
    const db = drizzle(d1, { schema: { ...schema} } )
	const tokenId = tokenInput;
	const tokenHash = encodeHex(await sha256(new TextEncoder().encode(tokenId)));
    let passwordResetTokenList = await db.select().from(password_reset_token).where(eq(password_reset_token.token_hash, tokenHash)).execute()   
    console.log(passwordResetTokenList)
    const passwordResetToken = passwordResetTokenList[0];
    if (!passwordResetToken){
        return {valid: false, foundToken: null};
    }
    const isCodeValid = passwordResetToken.expires_at as number > Date.now();
    if (!isCodeValid) {
        return {valid: false, foundToken: null};
    }
	return {valid: true, foundToken: passwordResetToken};
}