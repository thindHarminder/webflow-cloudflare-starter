import { z } from "zod";

 const signupSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    password: z.string().min(8).max(64).regex(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/)),
    emailNewsletter: z.string().optional(),
});

 const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().max(64),
});

 const emailVerificationSchema = z.object({
    code: z.string().length(6),
});

 const recoverPasswordSchema = z.object({
    email: z.string().email(),
});

 const resetPasswordSchema = z.object({
    password: z.string().min(8).max(64).regex(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/)),
    confirmPassword: z.string().min(8).max(64).regex(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/)),
    token: z.string().length(40),
});

 const todosSchema = z.object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).optional(),
    index: z.number().optional(),
    completed: z.boolean().optional(),
    due_date: z.number().optional(),
});

const todosBulkSchema = z.array(todosSchema);

const updateUserSettingsSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    profile_picture: z.string().url().optional(),
    password: z.string().min(8).max(64).optional(),
    newPassword: z.string().min(8).max(64).regex(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/)).optional(),
});

const uploadAssetSchema = z.object({
    file: z.object({
        image: z
          .any()
          .refine((file) => file?.size <= '200000', `Max image size is 5MB.`)
          .refine(
            (file) => ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file?.type),
            "Only .jpg, .jpeg, .png and .webp formats are supported."
          )
      })
});

export const zValidatorSchema = {
    signupSchema,
    loginSchema,
    emailVerificationSchema,
    recoverPasswordSchema,
    resetPasswordSchema,
    todosSchema,
    updateUserSettingsSchema,
    uploadAssetSchema,
    todosBulkSchema
};
