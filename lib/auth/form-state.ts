/**
 * 表单状态。
 *
 * 单独一个文件，不是放在 actions.ts 里的 —— `"use server"` 模块**只能导出
 * 异步函数**，多导出一个常量会让整个文件在构建时报错。类型本身是擦除的，
 * 放哪都行，但初始值是个真实的值，必须搬出来。
 */

export type AuthFormState = {
  /** 手机号字段下方的错误。 */
  phoneError?: string;
  /** 密码字段下方的错误。 */
  passwordError?: string;
  /** 昵称字段下方的错误（补昵称那一步）。 */
  nicknameError?: string;
  /**
   * 整个表单的错误，不属于任何一个字段。
   *
   * 「手机号或密码不对」只能放这里 —— 一旦把它挂到密码那个字段下面，就等于
   * 告诉调用方「号码是对的，只是密码错了」，那正是手机号枚举想要的信息。
   */
  formError?: string;
};

/**
 * `useActionState` 的初始值。必须是模块级常量：每次渲染新建一个 `{}` 会让
 * React 认为状态变了。
 */
export const AUTH_FORM_INITIAL: AuthFormState = {};

/**
 * 「我的」页里那两件事（改昵称 / 改密码）的表单状态。
 *
 * **不复用上面的 `AuthFormState`，尽管 `nicknameError` 那个字段看起来一样。** 那个类型
 * 说的是登录 / 注册那两块屏，它的每个字段都带着那条路上特有的含义 —— `formError` 之所以
 * 存在，是为了让「手机号或密码不对」有一个不挂在任何字段下面的位置。这里需要的是另一套
 * 语义：一个成功信号，加上三个各自独立的密码字段错误。
 *
 * 也**不另开一个文件**：产出它的 action 就在 lib/auth/actions.ts，一个 action 模块配一个
 * form-state 文件是这个仓库的惯例。
 *
 * `ok` 在这里**可以**区分成功与失败 —— 这点和 `AddFriendFormState.notice` 那条「几种
 * 结果一视同仁」的保证正好相反，别当成不一致：那条是为了不泄漏「这个手机号注册过没有」，
 * 而这里的调用者本来就是账号本人。何况两个对话框都需要一个「回执到了」的信号才能关上
 * （理由见 components/friend/add-friend-dialog.tsx 里关于 useActionState 的说明）。
 */
export type SettingsFormState = {
  /** 改昵称那一步的错误。 */
  nicknameError?: string;
  /** 「当前密码不对」以及「请输入当前密码」。 */
  currentPasswordError?: string;
  /** 新密码不合规。 */
  newPasswordError?: string;
  /** 两次输入的新密码不一致。 */
  confirmPasswordError?: string;
  /** 整个表单的错误，不属于任何一个字段（改密码被限流时落在这里）。 */
  formError?: string;
  /** 成功了。两个对话框都靠它决定「关上 + toast」。 */
  ok?: boolean;
};

/** 同上，必须是模块级常量。 */
export const SETTINGS_FORM_INITIAL: SettingsFormState = {};
