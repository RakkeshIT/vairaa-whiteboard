import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .min(1, "Email address is required.")
  .email("Please enter a valid email address (e.g. name@company.com).");

/**
 * Sign In: Email Submission Schema
 */
export const signInFormSchema = z.object({
  email: emailField,
});

/**
 * Create Account: Registration Details Schema (Name + Company + Email)
 */
export const registrationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Your full name is required.")
    .min(2, "Name must be at least 2 characters long.")
    .max(100, "Name cannot exceed 100 characters."),
  company: z
    .string()
    .trim()
    .max(120, "Company name cannot exceed 120 characters.")
    .optional(),
  email: emailField,
});

/**
 * Verification Code Schema
 */
export const otpFormSchema = z.object({
  otp: z
    .string()
    .trim()
    .min(1, "Verification code is required.")
    .length(6, "Verification code must be exactly 6 digits.")
    .regex(/^\d{6}$/, "Verification code must contain digits only."),
});
