/**
 * Field rules shared by the client forms and (later) the Server Actions.
 * These validate *shape* only — never authorization. A Server Action must
 * re-check the session and row ownership on its own.
 */

/** Mainland-China mobile numbers: 11 digits, 1, then 3–9, then 9 more. */
const CN_MOBILE = /^1[3-9]\d{9}$/;

/** Strips spaces, hyphens and a leading +86 / 86 country code. */
export function normalizePhone(raw: string): string {
  return raw
    .trim()
    .replace(/[\s-]/g, "")
    .replace(/^(\+?86)/, "");
}

export function isValidPhone(raw: string): boolean {
  return CN_MOBILE.test(normalizePhone(raw));
}

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordProblem =
  | "too-short"
  | "no-lowercase"
  | "no-digit"
  | "has-space";

/** Returns every rule the password breaks, so the form can list them all. */
export function checkPassword(password: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push("too-short");
  if (!/[a-z]/.test(password)) problems.push("no-lowercase");
  if (!/\d/.test(password)) problems.push("no-digit");
  if (/\s/.test(password)) problems.push("has-space");
  return problems;
}

export function isValidPassword(password: string): boolean {
  return checkPassword(password).length === 0;
}

export const PASSWORD_RULES: Record<PasswordProblem, string> = {
  "too-short": `密码至少 ${PASSWORD_MIN_LENGTH} 位`,
  "no-lowercase": "需要包含至少一个小写字母",
  "no-digit": "需要包含至少一个数字",
  "has-space": "密码不能包含空格",
};

/** 4-digit SMS code. */
export function isValidSmsCode(code: string): boolean {
  return /^\d{4,6}$/.test(code.trim());
}
