import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * 口令哈希。
 *
 * 用 Node 内置的 scrypt，不引第三方库：少一个依赖，也就没有「native 模块
 * 在部署机上编译不过」这类只在生产才炸的问题。scrypt 是内存硬的，拿 GPU
 * 堆并行的收益远小于 bcrypt，对个人项目够用。
 *
 * 存进库里的是一整串自描述的字符串：
 *
 *     scrypt:N:r:p:salt:hash
 *
 * 成本参数跟着哈希一起存，不是常量。这样以后调高 N 只需要改 `COST`——
 * 老密码仍然用它们当初那套参数验得过，不会出现「一升级，全体用户被自己的
 * 密码锁在门外」。
 */

/** 新密码使用的成本参数。改这里只影响此后新设的密码。 */
const COST = { N: 16384, r: 8, p: 1 } as const;

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const PREFIX = "scrypt";

/**
 * 解析一行已存哈希时允许的上限。
 *
 * 这些数字只可能来自我们自己的库，所以这不是在防攻击者，是**防一行坏数据
 * 把登录接口变成 CPU 炸弹**：scrypt 的开销随 N 线性上涨，一个被写坏的 N
 * 就能让每一次登录卡住好几秒。有了上限，最坏情况被钉死在 64 MiB / 次。
 */
const MAX_N = 2 ** 16;
const MAX_R = 8;
const MAX_P = 4;

/**
 * 用户不存在时拿来当靶子的哈希（明文是一个从没被使用过的随机串，值本身
 * 没有意义）。作用是抹平时间差：
 *
 * 如果「号码没注册」直接返回，那条路径**不跑 scrypt**，会比「号码注册了但
 * 密码错」快上几十毫秒。攻击者不用猜密码，靠响应时间就能问出某个手机号
 * 注册过没有 —— 这本身就是隐私。所以查不到人时也拿这个常量跑一遍。
 */
export const DUMMY_HASH =
  "scrypt:16384:8:1:98de5bb1e65819617575c0e9002a93c7:7116d0357b7ade81b7e0dd44ec14b2dcdc9bbcbef69b81c72f9c02d9892f0936";

/**
 * 口令先做 NFC 归一化再哈希。
 *
 * 同一个密码在不同输入法/系统上可能产生字节不同的等价序列（比如 é 是一个
 * 码点还是 e + 组合重音）。不归一化，用户在手机上设的密码到电脑上就登不
 * 进去，而且报的是「密码错误」，极难排查。
 *
 * NFC 而不是 NFKC：NFKC 会把「①」和「1」也合并掉，那是在偷偷改变密码的
 * 强度；NFC 只合并本来就等价的写法。
 */
function normalize(password: string): string {
  return password.normalize("NFC");
}

/** scrypt 需要的内存，再乘 2 留余量（Node 会因为超 maxmem 直接抛错）。 */
function memoryFor(n: number, r: number): number {
  return 128 * n * r * 2;
}

/**
 * 手写 Promise 包装，不用 `promisify`。
 *
 * `promisify(scrypt)` 只会挑中**不带 options 的那个重载**，于是想传 N/r/p
 * 的时候会被 TypeScript 挡住（Expected 3 arguments, but got 4）。这不是类型
 * 定义写错了，是 promisify 的类型推导只能保留一个重载。
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(normalize(password), salt, KEY_LENGTH, {
    ...COST,
    maxmem: memoryFor(COST.N, COST.r),
  });

  return [
    PREFIX,
    COST.N,
    COST.r,
    COST.p,
    salt.toString("hex"),
    hash.toString("hex"),
  ].join(":");
}

/**
 * 验密码。任何情况下都不抛异常 —— 一行坏数据应该等于「验不过」，而不是让
 * 登录接口 500。
 *
 * 注意下面 dkLen 传的是**常量** `KEY_LENGTH`，不是 `parsed.hash.length`。
 *
 * 一开始写的就是后者，理由是「以后换长度，老哈希也验得过」。那是错的，而且
 * 错得很隐蔽：scrypt 的最后一步是 PBKDF2，而 PBKDF2 对更短的 dkLen 的输出
 * 恰恰是更长输出的**前缀**。于是把一行哈希从末尾截短几位，再拿截短后的长度
 * 去派生，得到的正好是原哈希的前缀 —— 比对通过，密码随便什么都能过。
 * 自测里「哈希被截断」那条就是这么把它抓出来的。
 *
 * 危害不在于攻击者能利用它提权（能改库的人本来就能直接换掉哈希），而在于
 * **存储哈希的长度变成了一个由库内容自由决定的参数**：一行被写坏的 hash
 * 不会报错，而是悄悄降低有效强度后继续放行，现场不留任何痕迹。
 *
 * 所以长度必须是常量，解析时精确校验。真要改 KEY_LENGTH，换前缀
 * （`scrypt2:`）或做一次迁移 —— 那是有意为之的升级，不是让任意长度都能验。
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;

  let candidate: Buffer;
  try {
    candidate = await scryptAsync(normalize(password), parsed.salt, KEY_LENGTH, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: memoryFor(parsed.N, parsed.r),
    });
  } catch {
    // 参数越界时 scrypt 是**抛异常**而不是返回错值。吞掉，当作验不过。
    return false;
  }

  // timingSafeEqual 在两个 Buffer 长度不等时也会**抛异常**，不是返回 false。
  // 所以长度必须自己先比 —— 少了这一行，上面的 catch 就得再包一层。
  if (candidate.length !== parsed.hash.length) return false;
  return timingSafeEqual(candidate, parsed.hash);
}

type Parsed = {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
};

function parse(stored: string): Parsed | null {
  const parts = stored.split(":");
  if (parts.length !== 6) return null;

  const [prefix, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  if (prefix !== PREFIX) return null;

  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!isBoundedInt(N, MAX_N) || !isBoundedInt(r, MAX_R) || !isBoundedInt(p, MAX_P)) {
    return null;
  }
  // scrypt 自己要求 N 是 2 的幂，否则抛错
  if (N < 2 || (N & (N - 1)) !== 0) return null;

  const salt = fromHex(saltHex);
  const hash = fromHex(hashHex);
  if (!salt || !hash) return null;
  if (salt.length === 0) return null;
  // 必须**精确**等于 KEY_LENGTH —— 短一位就是上面说的前缀漏洞，长一位就是
  // 一行不属于这个格式的数据。见 verifyPassword 的注释。
  if (hash.length !== KEY_LENGTH) return null;

  return { N, r, p, salt, hash };
}

function isBoundedInt(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

function fromHex(value: string): Buffer | null {
  // Buffer.from(x, "hex") 碰到非法字符是**静默截断**，不是报错 ——
  // Buffer.from("zz", "hex") 得到的是一个空 buffer。不自己先验一遍，
  // 一个坏字符就能把整段哈希悄悄截短，然后验签在长度那一步返回 false，
  // 现场只剩「密码明明是对的却登不上」。
  if (value.length === 0 || value.length % 2 !== 0) return null;
  if (!/^[0-9a-f]+$/i.test(value)) return null;
  return Buffer.from(value, "hex");
}
