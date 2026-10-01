/**
 * 登录表单的状态形状。
 *
 * 单独一个文件，理由和 `lib/auth/form-state.ts` 一样：`"use server"` 模块
 * **只能导出 async 函数**，一个 `export const` 会让整个 actions.ts 编译失败。
 * 类型和常量住在这里，action 和页面都能 import。
 */

export type AdminFormState = {
  usernameError?: string;
  passwordError?: string;
  /** 表单级错误：不属于任何一个字段，比如「凭据不对」。 */
  formError?: string;
};

export const ADMIN_FORM_INITIAL: AdminFormState = {};
