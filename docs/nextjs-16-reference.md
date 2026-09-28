# Next.js 16.3.5 参考手册

> 本文档基于本地捆绑文档通读而成：`node_modules/next/dist/docs/`（456 个文件，与 `next@16.3.5` 精确对应）。
> 项目权威版本以此为准，**不要**依赖训练数据里的 Next.js 知识——16.x 有大量破坏性变更。
> 官网文档当前为 16.3.6，与本地差一个 patch。

---

## 目录

- [1. 当前项目状态](#1-当前项目状态)
- [2. 破坏性变更速查表](#2-破坏性变更速查表)
- [3. 缓存与渲染模型](#3-缓存与渲染模型)
- [4. 数据获取](#4-数据获取)
- [5. 变更数据：Server Actions 与表单](#5-变更数据server-actions-与表单)
- [6. 路由与文件约定](#6-路由与文件约定)
- [7. 组件](#7-组件)
- [8. next.config 配置](#8-nextconfig-配置)
- [9. 安全](#9-安全)
- [10. 交互与状态保留](#10-交互与状态保留)
- [11. 构建与部署](#11-构建与部署)
- [12. 工具链：MCP / Skills / Codemod](#12-工具链mcp--skills--codemod)
- [13. 文档中已知的不一致](#13-文档中已知的不一致)
- [14. 本地文档索引](#14-本地文档索引)

---

## 1. 当前项目状态

```
next        16.3.5      （Turbopack 默认打包器）
react       19.2.8      （App Router 实际用内置 canary，非此版本）
tailwindcss ^4          （v4 语法：@import 'tailwindcss'，无 tailwind.config.js）
typescript  ^5
```

- `next.config.ts` 目前**为空**，即 `cacheComponents` **未开启** → 项目当前运行在**路由级缓存模型**（行为接近 Next 15）。
- 业务代码仅有 `app/layout.tsx`、`app/page.tsx`、`app/globals.css`。全新项目，迁移成本为零。

### 待决策项：是否开启 `cacheComponents`

| | 关闭（当前） | 开启 `cacheComponents: true` |
|---|---|---|
| 缓存粒度 | 路由级（`dynamic` / `revalidate` / `fetchCache`） | 组件/函数级（`"use cache"`） |
| 渲染 | 路由要么静态要么动态 | PPR：每条路由都有静态外壳 |
| `fetch` 默认 | 不缓存 | 不缓存（需 `"use cache"` 包裹） |
| 路由段导出 | 可用 | `dynamic` / `revalidate` / `fetchCache` / `dynamicParams` **直接报错** |
| Runtime | 两者皆可 | **仅 Node.js**，`runtime = 'edge'` 不可用 |
| 导航状态 | 卸载路由 | React `<Activity>` 隐藏路由，**状态保留** |

**全新项目建议一开始就开启**——迁移成本为零，晚开则要跑 `migrating-to-cache-components` 那套改造。

---

## 2. 破坏性变更速查表

### 2.1 会静默写错的（最高优先级）

| 旧写法（来自旧版认知） | Next 16.3.5 正确写法 |
|---|---|
| `middleware.ts` + `export function middleware` | `proxy.ts` + `export function proxy`。**仅 Node runtime，设 `runtime` 会抛错** |
| `params.slug` | `await params` — 同步访问**已完全移除**，无兼容层 |
| `searchParams.q` | `await searchParams` |
| `const c = cookies()` | `const c = await cookies()` |
| `revalidateTag('posts')` | `revalidateTag('posts', 'max')` — 单参数是 TS 错误 |
| `error.js` 用 `reset` | 用 `retry`（v16.3.0 转正） |
| `unstable_cacheLife` / `unstable_cacheTag` | `cacheLife` / `cacheTag` |
| `experimental.ppr` / `dynamicIO` / `useCache` | 顶层 `cacheComponents: true` |
| `next lint` / build 自动 lint | 已移除；`next build` 不再 lint |
| `Image` 的 `priority` | 改用 `preload`（`priority` 已废弃） |
| 并行路由 `@slot` 无 `default.js` | **每个 slot 都必须有 `default.js`**，否则 build 失败 |

### 2.2 环境与工具链

- Node.js **20.9+**（18 已弃）、TypeScript **5.1+**、Chrome/Edge/Firefox 111+、Safari 16.4+
- **Turbopack 是默认打包器**（`next dev` 和 `next build`）。`--turbopack` 已成空操作；`--webpack` 才是真正的退出口。
- **自定义 `webpack` 配置会让 `next build` 直接失败**（防误配置）。若你没写 webpack 配置却报这个错，多半是某个插件注入的。
- `next dev` 输出到 **`.next/dev`**（不再是 `.next`），dev 和 build 可同时运行。
- `next.config` **不支持 `.cjs` / `.cts`**，只能用 `.ts` / `.mts` / `.js` / `.mjs`。
- `next dev` 加载配置只加载一次，`next.config` 里 `process.argv.includes('dev')` 恒为 `false` → 用 `process.env.NODE_ENV` 或 `phase`。
- ESLint 默认 **flat config**（`eslint.config.mjs`）。
- `experimental.useTypeScriptCli` **默认 `true`**：`next build` 会调用项目本地的 `tsc` 二进制，因此必须能解析到本地 `tsc`。

### 2.3 已移除

AMP 全家桶（`amp` 配置、`next/amp`、`useAmp`）、`next lint` + `eslint` 配置键、`serverRuntimeConfig` / `publicRuntimeConfig`、`swcMinify`、`target`、`devIndicators.{appIsrStatus,buildActivity,buildActivityPosition}`、`experimental.dynamicIO`、`experimental.useCache`、`experimental.ppr` + 路由级 `experimental_ppr`、`unstable_rootParams`（→ `next/root-params`）、`NextRequest.ip` / `.geo`。

### 2.4 已废弃但仍可用

`middleware` 文件约定、`runtime = 'edge'`、`preferredRegion`、`images.domains`、`next/legacy/image`、`unstable_cache`、`unstable_noStore`、`unstable_rethrow`（**至今仍无稳定版**）、`revalidateTag(tag)` 单参数、`skipMiddlewareUrlNormalize`、`experimental.turbo`、`Image` 的 `priority` / `onLoadingComplete`。

---

## 3. 缓存与渲染模型

### 3.1 两种模型由 `cacheComponents` 开关决定

```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { cacheComponents: true }
```

这是**顶层**配置，不在 `experimental` 下。它是把旧的 `ppr` + `useCache` + `dynamicIO` 三个实验开关合并成的单一开关。

开启后 **PPR 成为默认渲染行为**：每条路由都有一个静态外壳（static shell），动态内容流式补入。

### 3.2 `"use cache"` 指令

缓存**异步函数或组件**的返回值。三个作用域：

```ts
// 1. 函数级（数据层）
export async function getUsers() {
  'use cache'
  cacheLife('hours')
  return db.query('SELECT * FROM users')
}

// 2. 组件级（UI 层）—— 组件必须是 async
// 3. 文件级：文件顶部写 'use cache'，该文件所有导出都被缓存
```

被缓存的函数**必须是 async**。文件级指令下，框架导出（如 `generateMetadata`、`generateStaticParams`）也必须是 async。

### 3.3 三种变体

| | `'use cache'` | `'use cache: remote'` | `'use cache: private'` |
|---|---|---|---|
| 服务端缓存 | 内存（或 `cacheHandlers`） | 远程 cache handler | **无** |
| 缓存范围 | 所有用户 | 所有用户 | 按客户端（仅浏览器） |
| 可读 `cookies()`/`headers()`/`searchParams` | ❌ 需作参数传入 | ❌ | ✅ |
| 可用 `connection()` | ❌ | ❌ | ❌ |
| 可配自定义 cache handler | ✅ | ✅ | ❌ |

嵌套规则：remote 套 remote 可以，remote 套普通 `use cache` 可以；**remote 套 private 报错，private 套 remote 报错**。

### 3.4 缓存 key 与生命周期

缓存 key = `Build ID`（或 `deploymentId`）+ 函数 ID 的哈希 + 可序列化参数 + HMR hash（仅 dev）。

外层作用域捕获的变量会**自动绑定为参数**并计入 key：

```tsx
async function Component({ userId }: { userId: string }) {
  const getData = async (filter: string) => {
    'use cache'
    // key 同时包含 userId（闭包变量）和 filter（参数）
    ...
  }
}
```

> ⚠️ **缓存条目活不过一次部署**——key 含 build ID。跨部署持久化要用 `unstable_cache` 或 fetch Data Cache。
>
> ⚠️ **缓存 key 和 tag 是明文存储的**——参数即 key 的 map key，`cacheTag` 的值原样保存，都不做哈希。**不要把 token、密码、原始邮箱放进参数或 tag。**

### 3.5 序列化限制

- **参数**：原始类型、普通对象、数组、`Date`、`Map`、`Set`、TypedArray、ArrayBuffer、React 元素（仅透传）
- **返回值**：同上 + JSX
- **不支持**：类实例、函数（除透传）、`Symbol`、`WeakMap`、`WeakSet`、**`URL` 实例**

### 3.6 `cacheLife` 预设（精确值）

| Profile | `stale` | `revalidate` | `expire` |
|---|---|---|---|
| `default` | 5 min | 15 min | 永不过期 |
| `seconds` | 30 s | 1 s | 1 min |
| `minutes` | 5 min | 1 min | 1 hour |
| `hours` | 5 min | 1 hour | 1 day |
| `days` | 5 min | 1 day | 1 week |
| `weeks` | 5 min | 1 week | 30 days |
| `max` | 5 min | 30 days | 1 year |

语义：`stale` = 客户端可容忍的陈旧窗口；`revalidate` = 服务端后台再生成频率；`expire` = 无请求多久后下次请求阻塞等待。**`expire` 必须大于 `revalidate`**，否则报错。省略的字段继承 `default`。

**预渲染阈值（关键）：**
- `revalidate: 0` 或 `expire < 5 min` → **排除出预渲染**，变成请求时解析的「动态洞」
- `stale < 30 s` → **排除出预渲染**
- `stale ≥ 30s` 但 `< 5 min` → 进预渲染，但**不进 App Shell**

客户端缓存有 **30 秒最小 `stale`** 的强制下限，与配置无关。

**嵌套规则：** 外层显式 `cacheLife` 时以外层为准；外层没有时取 `default`，且**内层更短的寿命会缩短外层**。短寿命缓存嵌在无显式 `cacheLife` 的外层里会**在预渲染时抛错**。

自定义 profile 写在 `next.config.ts`：

```ts
const nextConfig = {
  cacheComponents: true,
  cacheLife: {
    biweekly: { stale: 1209600, revalidate: 86400, expire: 1209600 },
    // 覆盖内置 profile 也支持
    default: { stale: 300, revalidate: 3600, expire: 86400 },
  },
}
```

### 3.7 `cacheTag` 与失效

```ts
cacheTag('tag-one', 'tag-two')   // 幂等；单次最多 128 个 tag，每个最长 256 字符
revalidateTag(tag, 'max')        // 触发的是「请求」而非调用本身
```

四个失效 API：

| API | 签名 | 可在哪调用 | 行为 |
|---|---|---|---|
| `updateTag` | `updateTag(tag: string)` | **仅 Server Actions**（其他场景抛错） | 立即过期，下一个请求**等待**新数据 |
| `revalidateTag` | `revalidateTag(tag, profile)` | Server Functions + Route Handlers | Stale-while-revalidate，不阻塞 |
| `revalidatePath` | `revalidatePath(path, type?)` | Server Functions + Route Handlers | 按路径失效；有动态段时 `type` 必填 |
| `refresh` | `refresh(): void` | **仅 Server Actions** | 只刷新客户端路由，不动缓存 |

- `revalidateTag` 的第二个参数只有 `expire` 会被读取。`'max'` 推荐；`{ expire: 0 }` 表示从不提供陈旧内容（阻塞）。
- **`updateTag` 与 `refresh` 在 Server Action 之外调用会抛错。**
- `revalidatePath` 遇到 rewrite 要传**目标**路径；`revalidatePath('/', 'layout')` 会清空整个客户端缓存并失效所有缓存数据。
- 从 Server Action 调用这四个 API 中任意一个，会**立即清空整个客户端缓存**，绕过 stale 时间。

---

## 4. 数据获取

### 4.1 默认不缓存

> `fetch` 请求**默认不缓存**，会阻塞页面渲染直到完成。

默认模式叫 `auto no cache`：dev 下每次请求都取；`next build` 时因为路由会被静态预渲染所以只取一次。如果路由检测到请求时 API，则每次请求都取。

**缓存是 opt-in 的**：`fetch(url, { cache: 'force-cache' })`。`force-cache` 的匹配依据是 **URL + method + headers + body**，且只存 `200` 响应。

### 4.2 流式渲染用 `<Suspense>`

```tsx
export default function BlogPage() {
  return (
    <div>
      <header><h1>Welcome to the Blog</h1></header>
      <main>
        <Suspense fallback={<BlogListSkeleton />}>
          <BlogList />
        </Suspense>
      </main>
    </div>
  )
}
```

> ⚠️ 访问未缓存/运行时数据的 **layout 不会回退到同级 `loading.js`**，而是阻塞导航直到 layout 渲染完成。要在**靠近数据访问处**用 `<Suspense>`。

### 4.3 `React.cache` 与预加载

`fetch` 的 GET 同 URL+options 在**一次渲染过程内**自动 memoize（覆盖 `generateStaticParams`、`generateViewport`、layout、page），但**不覆盖 Route Handler**（不在 React 组件树内）。

对非 `fetch` 操作（ORM 等）用 `React.cache`：

```ts
import { cache } from 'react'
export const getUser = cache(async (id: string) => {
  return db.query.users.findFirst({ where: eq(users.id, id) })
})
```

> `React.cache` 作用域仅限当前请求。注意：在 `use cache` 边界内 `React.cache` 是**隔离的**，不能用它把数据传进 `use cache` 作用域。

预加载模式：

```tsx
export const preload = (id: string) => { void getItem(id) }
```

### 4.4 请求时与随机值

- **请求时 API**：`cookies()`、`headers()`、`searchParams`、`draftMode()`、`connection()`、`io()`
- 需要每请求唯一值（`Math.random()` / `Date.now()` / `crypto.randomUUID()`）时，先 `await connection()` 再调用，并包在 `<Suspense>` 里。`performance.now()` 豁免。
- 开启 Cache Components 后，在 `<Suspense>` 外读未缓存数据/运行时 API 会产生**构建期错误** + dev overlay 提示（`blocking-route`、`blocking-prerender-random`、`blocking-prerender-current-time`、`blocking-prerender-crypto`），并给出三种修法：`<Suspense>` 流式 / `use cache` 缓存 / `instant = false` 允许阻塞。

### 4.5 客户端数据获取

「如果客户端组件只需要读一次服务端数据，**把 Promise 传给它并用 React 的 `use()` 解包**」——多数场景不需要 SWR / TanStack Query。

只有需要**共享浏览器缓存**（focus 重验证、轮询、去重、跨组件乐观更新）时才引入库。三层缓存（Next 服务端 / Next 客户端 / 库缓存）各自独立，但**缓存标识与变更失效必须跨层协调**。

---

## 5. 变更数据：Server Actions 与表单

### 5.1 术语与基本约束

- **Server Function**：标了 `"use server"` 的异步服务端函数
- **Server Action**：作为 prop 传给客户端组件、或绑定到 form action 时，就叫 Server Action
- 底层用 **POST**，只有 POST 能触发
- **每个客户端一次只派发一个 action**——连续触发三个，第二个等第一个完成，第三个等第二个。**不要指望 `Promise.all` 并行**；要并行就在单个 action 内部并行，或用 Route Handler

### 5.2 哪些调用会带回 UI 重渲染

action 的响应同时携带返回值**和**当前路由新渲染的 RSC Payload，但只在 action 做了以下事情时才重渲染：

- `updateTag(...)` 或 `revalidatePath(...)`
- `refresh()`
- 通过 `cookies()` 改了 cookie（set/delete 自动重渲染）
- `redirect(...)`

**例外**：`revalidateTag(tag, 'max')`（SWR 语义）**不**带回重渲染。

`redirect` 抛的是控制流异常，其后的代码不会执行 → **把 revalidation 放在 `redirect` 之前**。

### 5.3 Canonical Server Action

```ts
// app/lib/actions.ts
'use server'
import { auth } from '@/lib/auth'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  const title = formData.get('title')
  // 写数据
  // 失效缓存
}
```

### 5.4 表单与 `useActionState`

```tsx
'use client'
import { useActionState } from 'react'

const [state, formAction, pending] = useActionState(createUser, initialState)
//      ↑        ↑          ↑
//    返回值   form action   pending（第三个元素）
```

> 用 `useActionState` 时，服务端函数的**第一个参数变成 `prevState`**：`async function createUser(prevState, formData)`。

```ts
// 带 Zod 校验
'use server'
import { z } from 'zod'
const schema = z.object({ email: z.string() })

export default async function createUser(prevState: any, formData: FormData) {
  const validated = schema.safeParse({ email: formData.get('email') })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
}
```

其他要点：
- `Object.fromEntries(formData)` 会带进 `$ACTION_` 前缀的额外字段
- 传额外参数用 `updateUser.bind(null, userId)`（支持渐进增强）；隐藏 input 的值在渲染出的 HTML 里且**不加密**
- `useFormStatus`（来自 `react-dom`）用于嵌套的提交按钮
- 乐观更新用 `useOptimistic`

---

## 6. 路由与文件约定

### 6.1 `proxy.ts`（原 `middleware.ts`）

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}
```

- 位置：项目根，或 `src/` 内，与 `app`/`pages` 同级
- 导出名：`proxy`（具名或默认）
- 也支持简写类型 `NextProxy`（来自 `next/server`）
- **Node.js runtime 专属，`runtime` 配置项不存在且设置会抛错**。需要 Edge 只能继续用 `middleware.ts`
- 每个项目只能有一个
- 配置项改名：`skipMiddlewareUrlNormalize` → **`skipProxyUrlNormalize`**（同时设置两者会抛错）
- `fetch` 的 `options.cache` / `options.next.revalidate` / `options.next.tags` 在 proxy 中**无效**
- 执行顺序：headers → redirects → **proxy** → beforeFiles → 文件系统路由 → afterFiles → 动态路由 → fallback
- `/_next/data` **始终**会经过 proxy，即使被 matcher 排除（有意为之，防止「保护了页面却泄露了数据路由」）

> ⚠️ **安全坑**：Server Function 不是独立路由，而是作为 POST 请求打到**使用它的那条路由**上。所以排除某路径的 matcher 也会跳过该路径上的 Server Function 调用。重构把 Server Function 挪到别的路由，会**静默地**让 proxy 覆盖失效。

### 6.2 路由类型是自动生成的

脚手架里 `app/layout.tsx` 写的是 `LayoutProps<"/">`，**不是** `{ children: React.ReactNode }`。这些是全局类型，无需 import：

```tsx
// app/blog/[slug]/page.tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
}
// app/api/users/[id]/route.ts
export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params
}
```

由 `next dev` / `next build` / `next typegen` 生成。生成的 `ParamMap` 让 `params` 在静态路由上解析为 `{}`。并行路由的 slot 也会进 `LayoutProps`（如 `props.analytics`）。

### 6.3 异步参数

```ts
params: Promise<ParamMap[AppRoute]>
searchParams: Promise<Record<string, string | string[] | undefined>>
```

**同步访问已完全移除**（Next 15 的兼容层没有了），无 fallback。

**反直觉的例外——这些仍是同步的：**
- `generateStaticParams({ params })` —— 同步可取，且只含父段参数
- `generateImageMetadata({ params })` —— 收到普通对象

**16.0.0 新变为异步的：**
- OG/Twitter/icon/apple-icon 的默认导出：`params` **和** `id` 都是 Promise
- `generateSitemaps` 的 `id` 是 Promise
- `generateMetadata` / `generateViewport` 的 `params`、`searchParams`、`parent` 都是 Promise

### 6.4 错误边界

```tsx
'use client'
export default function Error({ error, retry }: { error: Error & { digest?: string }, retry: () => void }) {
  // ...
}
```

- **`retry` 是新的推荐 prop**（v16.3.0 转正，v16.2.0 时叫 `unstable_retry`）
- `reset` 仍在，但文档明说「大多数情况下应该用 `retry()`」——`retry` 会重新 fetch，`reset` 只清错误状态
- 组件级（非路由段级）错误恢复用 `catchError`（来自 **`next/error`**，v16.3.0）

### 6.5 路由段配置已大幅精简

剩下的：`dynamicParams`、`runtime`、`preferredRegion`、`maxDuration`，加上两个新的（**仅 Cache Components**）：

```tsx
export const instant: true | false | { level?: 'warning' } = false
export const prefetch: 'auto' | 'partial' | 'force-disabled' = 'partial'
```

开启 Cache Components 后，`dynamic` / `revalidate` / `fetchCache` / `dynamicParams` 会**报错**。

`instant = false` 是逃生舱：标记该段「允许阻塞」。它**不**强制动态渲染，也**不**清除同步 IO 的构建错误；只是让你免于预渲染校验。注意它**没有 fallback UI**——用户会一直看到空白直到查询完成。

### 6.6 新增文件约定

| 约定 | 说明 |
|---|---|
| `proxy.js` | 见 6.1 |
| `forbidden.tsx` | 403，**实验性**，需 `experimental.authInterrupts` |
| `unauthorized.tsx` | 401，**实验性**，同上 |
| `global-not-found.js` | **实验性**，需 `experimental.globalNotFound: true`，必须返回完整 HTML 文档 |
| `global-error.js` | 仍存在，但**无独立文档页**（在 `error.md` 里）。必须自带 `<html>`/`<body>`，不支持 `metadata`，不继承全局样式 |

`instrumentation.js` 的 `onRequestError` 回调中 `context.routeType` 新增 **`'proxy'`**，`renderType` 新增 `'dynamic-resume'`（即 PPR）。

---

## 7. 组件

### 7.1 `next/image`（破坏性变更最多）

| 项 | 变化 |
|---|---|
| `priority` | **已废弃** → 改用 `preload` |
| `qualities` | **16 起必填**，默认 `[75]`；越界值被强制到最近允许值；REST API 对不允许的 quality 返回 400 |
| `minimumCacheTTL` | 60s → **14400s（4 小时）** |
| `imageSizes` | **移除 `16`** → `[32, 48, 64, 96, 128, 256, 384]` |
| `maximumRedirects` | 新增，默认 **3**（原为无限） |
| `dangerouslyAllowLocalIP` | 新增，默认 `false`——本地/私有 IP 默认被阻止 |
| `localPatterns.search` | 本地图片带 query string 时**必须**配置此项 |
| `domains` | 已废弃 → 用 `remotePatterns` |
| `next/legacy/image` | **已废弃** |

### 7.2 `next/link`

- **`transitionTypes`**（16.2.0 新增）：`transitionTypes={['slide-in']}`，传给 `React.addTransitionType`
- `prefetch` 接受 `Boolean | "auto" | null`，默认 `"auto"`
- 开启 `partialPrefetching` 后：`"auto"` 预取路由的 **App Shell**；`prefetch={true}` 额外解析 URL 数据，**代价是每个链接一次服务端调用**
- `useLinkStatus` 来自 **`next/link`**（不是 `next/navigation`），返回 `{ pending }`

### 7.3 `next/script` / `next/form` / `next/font`

基本未变。`next/font` 自 13.2.0 起无变化。

---

## 8. next.config 配置

### 8.1 新增顶层配置

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,        // 16.0.0，见第 3 节
  partialPrefetching: true,     // 16.3.0，**依赖 cacheComponents**，否则配置校验抛错
  cacheHandlers: {},            // 16.0.0，plural；'use cache' 用这个
  cacheLife: {},                // 自定义 profile
  cacheMaxMemorySize: 0,        // 默认 50MB；0 关闭服务端缓存
  reactCompiler: true,          // 已稳定但**默认关闭**
  typedRoutes: true,            // 已稳定
  adapterPath: '',              // 16.2.0 转为稳定顶层
  supportsImmutableAssets: true,// 16.3.0 —— 提供商不支持时会导致部署损坏
  outputHashSalt: '',           // 16.3.0；NEXT_HASH_SALT 会拼接上去
  instrumentationClientInject: [], // 16.3.0
}
```

> ⚠️ `cacheHandler`（单数）用于 Pages Router 的 ISR，**不**被 `'use cache'` 使用。`'use cache'` 用 `cacheHandlers`（复数）。

### 8.2 改名

| 旧 | 新 |
|---|---|
| `experimental.turbo` | `turbopack` |
| `skipMiddlewareUrlNormalize` | `skipProxyUrlNormalize` |
| `experimental.browserDebugInfoInTerminal` | `logging.browserToTerminal` |
| `experimental.typedRoutes` | `typedRoutes` |
| `experimental.middlewarePrefetch` | `proxyPrefetch` |
| `experimental.externalMiddlewareRewritesResolve` | `externalProxyRewritesResolve` |
| `incrementalCacheHandlerPath` | `cacheHandler` |

### 8.3 Turbopack

- `turbopack.resolveAlias`（替换 webpack 的 `resolve.fallback`）
- `turbopack.root`、`rules`、`resolveExtensions`、`debugIds`、`ignoreIssue`
- 文件系统缓存**默认开启**（`experimental.turbopackFileSystemCacheForDev` / `...ForBuild`）——**不存在**叫 `turbopackFileSystemCache` 的单一键
- 不支持：webpack 插件（loader 支持）、Yarn PnP、`experimental.urlImports`、`experimental.esmExternals`、`sassOptions.functions`、Sass `~` 波浪号导入、`nextScriptWorkers`、`fallbackNodePolyfills`

### 8.4 仍属实验性——不要假设已转正

`experimental.serverActions`（**陷阱**：文档页名叫 `serverActions.md`，但所有示例都用 `experimental.serverActions`，它从未转正）、`authInterrupts`、`useOffline`、`proxyClientMaxBodySize`、`cssChunking`、`inlineCss`、`staleTimes`、`taint`、`urlImports`、`mdxRs`、`useLightningcss`、`optimizePackageImports`、`serverComponentsHmrCache`、`useTypeScriptCli`、`staticGeneration*`。

---

## 9. 安全

### 9.1 最重要的一条（文档反复强调）

**页面级的鉴权检查不会延伸到该页面内定义的 Server Action。**

```tsx
export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.isAdmin) redirect('/login')   // ← 只控制渲染哪个 UI

  return (
    <form action={async () => {
      'use server'
      const session = await auth()                    // ← 必须自己再验一次
      if (!session?.user?.isAdmin) throw new Error('Unauthorized')
      await db.record.deleteMany()
    }}>
      <button>Delete Records</button>
    </form>
  )
}
```

> 「Server Action 是一个独立入口，必须自行验证调用者。」

### 9.2 Server Action 是公开端点

> 当 Server Action 被创建并导出时，它**可以通过直接的 POST 请求触达**，而不仅是通过你的应用 UI。即使某个 Server Action 或工具函数在代码中没被任何地方 import，它**仍然能被外部调用**。

框架内建防护：CSRF（比对 `Origin` 与 `Host`/`X-Forwarded-Host`，不匹配则拒绝，仅 POST）、1MB 请求体上限（`serverActions.bodySizeLimit`）、加密的 action ID、dead code elimination、闭包变量加密传输。

但文档明确：即便有这些，**你仍应把 Server Action 当作可被直接 POST 触达的端点，在其内部验证鉴权与授权**。

### 9.3 授权 ≠ 鉴权（防 IDOR）

> Schema 校验（zod 等）只检查输入的**形状**。一个格式合法的 `Item` 对象，仍可能指向调用者并不拥有的数据行。

```ts
// 不安全：整个 item 来自客户端，任何人都能标记任意条目
export async function completeItemUnsafe(item: Item) {
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}

// 安全：只接收变更，身份从 session 推导，按所有权查询
export async function completeItem(itemId: string) {
  const session = await auth()
  if (!session?.user) return
  const item = await db.item.findFirst({ where: { id: itemId, ownerId: session.user.id } })
  if (!item) return
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}
```

### 9.4 三种数据获取方式——官方建议选一种，别混用

> 「我们建议选定一种数据获取方式并避免混用。这让开发者和安全审计人员都清楚预期是什么。」

1. **外部 HTTP API** —— 适合已有的大型应用/组织
2. **Data Access Layer（DAL）** —— **新项目推荐**
3. **组件级直接访问** —— 仅限原型/学习，文档明说容易泄露私有数据

DAL 形态：

```ts
// data/auth.ts
import { cache } from 'react'
import { cookies } from 'next/headers'

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get('AUTH_TOKEN')
  const decoded = await decryptAndValidate(token)
  return new User(decoded.id)   // 用类，避免整个对象被误传到客户端
})
```

> 「密钥应存在环境变量中，但**只有 DAL 应该访问 `process.env`**。」

`import 'server-only'` —— Next.js **内部处理** `server-only`，NPM 包内容不被使用；安装它只是为了满足 lint 规则。

### 9.5 其他

- **渲染期间禁止副作用**：Next.js 明确阻止在 render 中设置 cookie 或触发缓存失效。登出、写库、失效缓存都必须是 Server Action，不能是靠 `searchParams` 驱动的渲染期副作用
- **不要在 layout 里 `return null` 做鉴权**——文档明确「不推荐」。layout 不控制其余路由是否渲染；路由段和并行 slot 由 router 渲染，layout 隐藏或替换它们**不阻止它们运行，也不阻止它们出现在 RSC Payload 中**
- **proxy 里只做乐观检查**（只读 cookie，别查库）——因为 proxy 在**每条路由包括预取路由**上都会跑
- **action ID 会轮换**：新部署生成新 ID（**至少每 14 天**轮换一次，即使源码没变）。陈旧客户端会拿到 `Failed to find Server Action`。缓解：滚动部署 + 稳定的 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` + 把该错误暴露成重试路径
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 必须是 base64 且解码后为 16/24/32 字节（`openssl rand -base64 32`）
- `experimental.taint` 可启用 `experimental_taintObjectReference` / `experimental_taintUniqueValue`

### 9.6 审计清单（官方版）

- **DAL**：确认数据库包和 env 变量没有在 DAL 之外被 import
- **`"use client"` 文件**：props 是否期望私有数据？类型签名是否过宽？
- **`"use server"` 文件**：参数校验了吗？用户重新鉴权了吗？所有权检查了吗？返回值过滤了吗？数据库访问是否委托给 `server-only` DAL？
- **`/[param]/` 目录**：带方括号的目录是用户输入，参数校验了吗？
- **`proxy.ts` 和 `route.ts`**：「拥有很大权力，值得额外花时间审计」

---

## 10. 交互与状态保留

### 10.1 `<Activity>`（需 Cache Components）

行为**根本性变化**：页面导航时**不再卸载**，而是用 React `<Activity>` 设为 `display: none`，保留 React 状态和 DOM 状态（表单草稿、滚动位置、`<details>` 展开、视频进度）。

- **最多保留 3 条路由**，更早的被驱逐并重新渲染
- effect 在隐藏时清理，可见时重新执行

**会因此出问题的常见模式：**

| 模式 | 后果 | 修法 |
|---|---|---|
| 下拉/弹窗 | 导航回来时仍是展开的 | 在 `useLayoutEffect` 的 cleanup 里 `setIsOpen(false)` |
| 对话框初始化逻辑 | 离开时是开着的，回来 `true → true` 无状态变化，**focus effect 不再触发** | 把开关状态派生自 `searchParams`（URL），而非组件 state |
| 表单值 | 提交后仍保留 | 在提交处理器里重置 |
| 全局样式 | 隐藏页面的样式（CSS 变量、z-index）会影响可见页面 | 用回调 ref 切换 stylesheet 的 `media` 属性 |
| `<video>`/`<audio>` | `display: none` **不停止播放** | `useLayoutEffect` cleanup 里 `video?.pause()` |

- **登出要用 `window.location.href`**（整页刷新清空所有客户端状态），不要用 `router.push`。文档明确指出 Activity 会跨导航保留状态**包括鉴权变化**——「一个用户起草的内容不应该被另一个用户看到」
- 全局状态优先用 React 拥有的 `data-*` 属性（如 `<html data-modal-open>`），`:has()` 只用于局部父子样式；**宽泛的 `:has()` 选择器是真实的性能瓶颈**
- `router.bfcacheId` 用作 React `key` 可重置整棵子树。**它主要是迁移工具**，新代码优先用逐模式的显式重置

### 10.2 交互应用八步法

步骤 1–7 **不需要** Cache Components，步骤 8 需要。这是「怎么把应用做得跟手」最实用的一篇。

| 场景 | 用什么 |
|---|---|
| 慢数据不该阻塞页面 | `<Suspense>` |
| 异步进行中就该更新的值 | `useOptimistic` |
| 需要 pending / error / 协调 UI | `useTransition` |
| 表单需要 pending + 重置 + 结果状态 | `useActionState` |
| 祖先要显示别处的 pending | `data-pending` + CSS |
| 可复用的读、写后要新鲜 | `'use cache'` + `cacheTag` + `updateTag`/`revalidateTag` |
| 导航要瞬时 | `<Link>` 预取、Partial Prefetching、`prefetch={true}` |

**两个关键机制：**

1. 在 transition 内，`useState` 的 setter 会**延迟到 transition 完成**才生效，但 **`useOptimistic` 的 setter 和直接 DOM 调用（如 `formRef.reset()`）在当前帧就生效**。
2. `await` **之后**的状态更新不会自动属于该 transition——需要显式 `startTransition(() => setIsOpen(false))`。这是有文档记载的 React 限制。

**命名约定**：props 名为 `action` 或以 `Action` 结尾，表示「在 transition 里运行我」。TypeScript 插件据此放行；其他函数 prop 会被标记。

### 10.3 防止水合前闪烁

核心手法：**在 HTML 解析期间、首次绘制之前同步执行的内联脚本** + `suppressHydrationWarning`。

```tsx
<p id="event-date" suppressHydrationWarning>
  {new Date(event.date).toLocaleDateString()}
</p>
<script dangerouslySetInnerHTML={{ __html: `document.getElementById("event-date").textContent=new Date("${event.date}").toLocaleDateString()` }} />
```

`suppressHydrationWarning` 的语义：**没有**它时，React 视文本不匹配为水合错误，会从最近的 error/Suspense 边界重新客户端渲染——这会导致闪烁，**并且该边界内其他组件的内联脚本修正会丢失**（React 重建 DOM 时脚本不会重新执行）。**有**它时，React 保留 DOM 中的内容，丢弃该元素的客户端输出——**DOM 赢**。

`useEffect` 太晚（水合且绘制之后）；`useLayoutEffect` 太晚（水合之后）；内联脚本在**解析期间**执行，早于 React 介入。

> ⚠️ 严格 CSP 会阻止 `dangerouslySetInnerHTML` 的内联脚本，需要 nonce。
>
> ⚠️ 在根 layout 里用 `cookies()` 读主题 cookie 会**让整个应用退出静态预渲染**（开启 Cache Components 后**强制阻塞该 layout 下每一段**）。应该在**内联脚本里**读 cookie。

### 10.4 View Transitions

从 **`react`** 导入（不是 `next`）：`import { ViewTransition } from 'react'`。App Router 用 React canary，**已内置，无需自行安装 `react@canary`，无需配置**。

**由 Transitions、`<Suspense>`、`useDeferredValue` 激活；普通 `setState` 不触发。** 在 Next.js 中路由导航即 transition，所以自动激活。

- 共享元素变形：两端用同一个 `name` + `share="morph"` + **`default="none"`**。少了 `default="none"`，每个命名的 `<ViewTransition>` 会在每次无关跳转时都动画；少了 `share`，配对会静默地不生效。变形**只在目标页与导航在同一 commit 渲染时**才播放（即已预取/已缓存）
- 方向性导航用 `transitionTypes`，**wrapper 要放在每个 `page.tsx` 里而不是 layout**——「layout 跨导航持续存在，所以 enter/exit 在那里永远不会触发」
- 浏览器前进/后退**不携带 transition type**，方向性滑动在那种情况下不播放
- 过渡期间 `::view-transition { pointer-events: none; }`
- 尊重 `prefers-reduced-motion`

---

## 11. 构建与部署

### 11.1 构建阶段

Setup → 路由发现（含 `proxy`、`instrumentation`，生成 TS 路由定义）→ 编译（Turbopack，类型检查并行）→ 静态分析（预渲染分类、`generateStaticParams`、预渲染阻塞检查）→ 预渲染（HTML + RSC payload）→ 输出。

### 11.2 路由表符号

| 符号 | 名称 | 行为 |
|---|---|---|
| `○` | Static | 构建期完全预渲染 |
| `◐` | Partial Prerender | 静态外壳立即返回，动态内容流式补入 |
| `●` | SSG | 预渲染静态 HTML |
| `ƒ` | Dynamic | 每请求服务端渲染 |

开启 Cache Components 后 `◐` 成为默认模型，`ƒ` 只在**没有任何东西可预渲染**时出现。

`size` / `First Load JS` 指标已从 `next build` 输出中**移除**（对 RSC 不准）。

### 11.3 一定会遇到的构建错误

```
Error: Route "/products/[id]": Next.js encountered uncached or runtime data during prerendering.

Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache]  For uncached data (`fetch`, database calls): cache the access with `"use cache"`
  - [block]  Set `export const instant = false` to allow a blocking route
```

- **运行时数据**：`params`、`searchParams`、`cookies()`、`headers()`、`connection()`
- **未缓存数据**：`fetch()`、数据库调用
- **随机值与时间戳**（`Math.random()`、`new Date()`）也会让构建失败
- `next build --debug-prerender` 关闭压缩、开启服务端 source map、**遇到第一个失败后继续**。**警告：不要部署用它产出的构建**
- `next build --debug-build-paths="app/products/[id]/page.tsx"` 只编译指定路由
- **`generateStaticParams` 必须返回至少一个参数**——空数组现在是构建错误（`empty-generate-static-params`）。删掉该导出则完全退出 ISR

### 11.4 环境变量

**加载顺序**（先找到的胜出）：

1. `process.env`
2. `.env.$(NODE_ENV).local`
3. `.env.local`（`NODE_ENV=test` 时**跳过**）
4. `.env.$(NODE_ENV)`
5. `.env`

- **默认只有服务端可见**。`NEXT_PUBLIC_` 的值**在构建期内联并冻结**——「构建之后，你的应用不再响应这些环境变量的变化」
- **动态查找不会被内联**：`process.env[varName]` 和 `const env = process.env; env.NEXT_PUBLIC_X` 都失效
- **运行时环境变量**：读 `process.env` 前先 `await connection()`（来自 `next/server`）。这让同一个 Docker 镜像能跨环境晋级
- `.env.*` 文件在**项目根目录**——**不会从 `/src` 加载**
- `NODE_ENV` 只允许 `production` / `development` / `test`
- `.env.test` **应该提交**；`.env.test.local` 不应该

### 11.5 PPR 平台侧（如需自建 CDN 层）

每条 PPR 路由产出：静态 HTML 外壳、**`postponedState`**（序列化字符串，**当作不透明数据**，不要解析或修改）、静态部分的 RSC payload。

> 外壳与 `postponedState` **必须原子地存储和更新**。新的外壳配旧的 postponed state 会产生错误输出。

恢复协议：向该路由 `POST`，header `next-resume: 1`，body 为 `postponedState`。构建产物中通过 `outputs.prerenders` 里的 `renderingMode: 'PARTIALLY_STATIC'` 找到 PPR 路由。

### 11.6 测试

**Jest / Vitest / Cypress 的文档都重复同一句：**

> 「由于 async Server Components 是 React 生态的新事物，[工具] 目前不支持它们。你仍可以对**同步**的服务端和客户端组件跑单元测试，但对 **async** 组件我们建议用 **E2E 测试**。」

- Jest 用 `next/jest` transformer（自动处理 transform、CSS/图片/`next/font` mock、`.env` 变体加载）
- Vitest 用 `vitest.config.mts`，**默认 watch 模式**
- Playwright 用 `webServer` 选项，或针对生产构建跑（`npm run build && npm run start`）
- Cypress **低于 13.6.3 的版本不支持 TypeScript 5 + `moduleResolution: "bundler"`**
- ⚠️ 开启 Cache Components 后，隐藏的 Activity 内容**仍在 DOM 中**（`display: none`），朴素选择器会命中它。用可见性感知的查询（`getByRole`、`getByLabel`、`.filter({ visible: true })`）

---

## 12. 工具链：MCP / Skills / Codemod

### 12.1 关于本项目的 `AGENTS.md`

`AGENTS.md` 里那段「This is NOT the Next.js you know」是**官方机制自动写入的**。文档 `ai-agents.md` 明确说明：

- Next.js 把版本匹配的文档打包进 `node_modules/next/dist/docs/`
- `create-next-app` 生成 `AGENTS.md` + `CLAUDE.md`（`--no-agents-md` 可跳过）
- **16.3+ 的 `next dev` 在检测到 AI coding agent 时会自动生成/补回**这个 managed block，保留块外内容
- 写入逻辑在 `node_modules/next/dist/server/lib/generate-agent-files.js`
- 关闭：`next.config.ts` 里 `agentRules: false`（文档不推荐关闭）

**官方立场**：「框架知识来自捆绑文档，而不是 Skills。基准测试显示常驻可用的上下文优于按需检索。Skills 覆盖的是**工作流**而非查阅。」

### 12.2 MCP 服务器

需要 Next.js 16+。`.mcp.json`：

```json
{
  "mcpServers": {
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    }
  }
}
```

dev server 内置 `/_next/mcp` 端点，`next-devtools-mcp` 自动发现并转发。暴露的工具：

| 工具 | 用途 |
|---|---|
| `get_errors` | 构建错误、运行时错误、类型错误 |
| `get_logs` | dev 日志文件路径（含浏览器 console） |
| `get_page_metadata` | 路由、组件、渲染信息 |
| `get_project_metadata` | 项目结构、配置、dev server URL |
| `get_routes` | 所有路由，按 router 类型分组 |
| `get_server_action_by_id` | 由 ID 反查 Server Action 的源文件与函数名 |
| `get_compilation_issues` | 编译告警/错误（**仅 Turbopack**） |
| `compile_route` | 按需编译单个路由，**无需完整 build**（仅 Turbopack） |

另外 `next dev` 会把浏览器 console 的错误/警告转发到终端（`logging.browserToTerminal`），并把 PID/端口/URL 写入 `.next/dev/lock`——第二个 `next dev` 会打印正在运行的服务器 URL 而不是重复启动。

### 12.3 Skills

```bash
npx skills add vercel/next.js --skill next-dev-loop
npx skills add vercel/next.js --skill next-cache-components-adoption
npx skills add vercel/next.js --skill next-cache-components-optimizer
npx skills add vercel/next.js --skill next-partial-prefetching-adoption
npx skills add vercel-labs/agent-skills --skill vercel-react-view-transitions
```

### 12.4 Codemod

```bash
npx @next/codemod@canary upgrade latest                      # 综合升级
npx @next/codemod@canary next-async-request-api .            # 同步→异步请求 API
npx @next/codemod@canary middleware-to-proxy .               # middleware → proxy
npx @next/codemod@canary cache-components-instant-false ./app # 批量加 instant=false 逃生舱
npx @next/codemod@canary remove-partial-prefetch .           # 移除 prefetch='partial'
```

> ⚠️ `cache-components-instant-false` 传错路径会报 `0 ok` 而不报错——**确认文件数**。src 项目要传 `./src/app`。

`upgrade` codemod **不会**运行所有迁移 codemod。如果代码里仍有同步的 `params`/`searchParams`/`cookies()`/`headers()`/`draftMode()`，需要另外跑 `next-async-request-api`。

### 12.5 按错误查文档

`/docs/messages` 下的按错误页是**专门写给 agent 看的**——每种修法的标准模式、与其他修法的权衡、以及首次尝试容易漏掉的坑。注意这些页面**不在本地捆绑包中**（本地没有 `messages/` 目录）。URL 加 `.md` 后缀可拿到纯 Markdown。

---

## 13. 文档中已知的不一致

阅读时发现的低置信度区域，用文档时注意：

1. `03-api-reference/07-edge.md` 仍称 Edge Runtime 「用于 Proxy」，与 `proxy.md` 和 `version-16.md` **矛盾**（proxy 是 Node-only，设 `runtime` 会抛错）。**以 `proxy.md` 和升级指南为准。**
2. 五个已发布文档都链接到 `/docs/messages/edge-runtime-deprecated`，但该页**不在**本地捆绑包中。
3. `05-config/01-next-config-js/webpack.md` 描述 `webpack` 函数时**没有**任何废弃或 Turbopack 提示，尽管 `next build` 现在检测到它会直接失败。
4. `next.md` 的 `next info` 示例输出是陈旧的（显示 `next: 15.0.0-canary.115`、`react: 19.0.0-rc`）。
5. Adapter 文档在 proxy 改名后仍把 `outputs.middleware.sourcePage` 记为 `"middleware"`、`pathname` 记为 `"/_middleware"`——不要以这些值为判断依据。
6. `experimental.ppr` 在 `config-shared.d.ts` 里作为 `@deprecated` 的 shim **仍然存在**，所以 TS 不会报错，但文档说它已移除。**不要依赖它。**
7. `production-checklist.md` 里 PPR 那条带 `{/* TODO: Update when PPR is stable */}` 标记，属于陈旧文本。
8. `config-shared.d.ts` 里 `partialPrefetching` 还接受一个未文档化的 `'unstable_eager'` 值。

---

## 14. 本地文档索引

根目录：`node_modules/next/dist/docs/`

```
index.md
01-app/
  01-getting-started/    18 篇 —— 核心惯用法（layout/page、server/client、fetch、mutate、cache、proxy…）
  02-guides/             70 篇 —— 实用指南（forms、auth、data-security、interactive-apps…）
     upgrading/          version-14 / 15 / 16 升级指南 + codemods
     testing/            jest / vitest / playwright / cypress
     migrating/          各种迁移
  03-api-reference/
    01-directives/      use cache / use cache private / use cache remote / use client / use server
    02-components/      link / image / script / form / font
    03-file-conventions/ layout page route error loading not-found proxy default …
    04-functions/       43 个函数
    05-config/          74 个 next.config 选项
    06-cli/             含 next typegen / next upgrade / next experimental-analyze
    07-adapters/        Adapters API（全新）
    08-turbopack.md
  04-glossary.md         术语表（建立新模型词汇体系的最佳入口）
02-pages/                Pages Router（本项目不用）
03-architecture/         编译器、Fast Refresh、支持的浏览器
04-community/            贡献指南、Rspack
```

### 高优先级必读

| 文件 | 为什么 |
|---|---|
| `01-app/04-glossary.md` | 新模型的词汇表，最快建立正确心智模型 |
| `01-app/02-guides/upgrading/version-16.md` | 完整破坏性变更清单 |
| `01-app/01-getting-started/08-caching.md` | 新缓存模型 |
| `01-app/02-guides/migrating-to-cache-components.md` | 开启 flag 后要改什么 |
| `01-app/02-guides/interactive-apps.md` | 八步法，最实用的应用构建指南 |
| `01-app/02-guides/data-security.md` | 安全 Checklist |
| `01-app/02-guides/preserving-ui-state.md` | `<Activity>` 带来的行为陷阱 |
| `01-app/03-api-reference/03-file-conventions/proxy.md` | proxy 完整语义 |
