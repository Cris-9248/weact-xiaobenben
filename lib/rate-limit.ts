import "server-only";

/**
 * 按账号计的内存滑动窗口限流。目前有两条独立的窗口：添加好友、修改密码。
 *
 * **先说它不是什么。** 这不是分布式限流：计数在进程内存里，所以
 *   - 进程重启就清零 —— 一次部署等于给所有人重置额度；
 *   - 多实例部署时每个实例各算各的，实际额度是实例数的倍数。
 *
 * 本项目的部署就是一个 docker compose 单实例（见 docker-compose.yml），这两个
 * 前提都成立，所以这个取舍站得住。要更强的保证得上共享存储（Redis，或者一张
 * 计数表），那是另一次改动 —— 现在引入它，代价远大于它挡下的风险。
 *
 * **它挡的是什么。** 两条窗口挡的都是「一个已经登录的账号，拿一个只有一个正确答案
 * 的问题反复试」：一条是拿手机号列表试探谁注册过，一条是拿偷来的会话 cookie 猜当前
 * 密码。单次请求本身不可观测（前者的四种结果返回同一条文案，见 lib/friends/actions.ts），
 * 但「不可观测」不等于「不能大量试」—— 试得够多，命中率本身就是答案。限流把成本从
 * 「一次请求」抬到「一小时若干次」。
 *
 * **为什么按 userId 而不是 IP。** 两条窗口的调用者都必须已登录才能走到这里；按 IP 计
 * 会让同一个出口后面的多个真实用户互相挤掉额度，而攻击者换一个 IP 就绕过去了。
 * userId 是这里唯一既有意义又难以伪造的键 —— 它来自会话，不是请求头。
 *
 * **为什么两个桶是分开的两个 Map，不是一个。** 共用一个计数的话，一个已登录的人拿
 * 一批号码去试就能把额度刷满，然后**同一个账号连自己的密码都改不了**；反过来一个人在
 * 改密码上试错几次，也会连带加不了好友。把两个不相干的功能串进一个额度，等于让其中
 * 一个给另一个当拒绝服务的道具。分开之后，各自的额度只影响自己。
 */

const WINDOW_MS = 60 * 60 * 1000;

/** 超过这个 key 数量时顺手清理一遍过期记录。按桶各算各的。 */
const SWEEP_AT = 1000;

/**
 * 添加好友：一小时 20 次。数的是「尝试」—— 同一个号码试几次很正常（打错了、
 * 对方换了号），所以给得宽。
 */
const MAX_ADD_FRIEND_ATTEMPTS = 20;

/**
 * 修改密码：一小时 5 次。数的是「猜测」—— 当前密码只有一个正确答案，一小时里
 * 改五次密码不正常，一小时里试五次当前密码就太正常了。对真人绰绰有余，对爆破
 * 则把成本抬到「一天一百多次」这个没有意义的量级。
 */
const MAX_PASSWORD_ATTEMPTS = 5;

const addFriendAttempts = new Map<string, number[]>();
const passwordAttempts = new Map<string, number[]>();

/**
 * 记一次尝试，返回是否放行。
 *
 * 被限流时返回 `false`。**要不要如实告诉用户**取决于这个端点泄不泄漏信息：添加好友
 * 必须用和成功完全一样的响应（见 lib/friends/actions.ts），否则限流本身成了一种可观测
 * 的区分信号，把防枚举那件事从侧门泄回去；修改密码可以直说（见 lib/auth/actions.ts），
 * 因为调用者本来就是账号本人，说一句「太频繁」不泄漏他本来不知道的事。
 */
function consumeAttempt(
  bucket: Map<string, number[]>,
  key: string,
  max: number,
): boolean {
  const now = Date.now();
  const recent = (bucket.get(key) ?? []).filter((at) => now - at < WINDOW_MS);

  if (recent.length >= max) {
    // 仍然把裁剪过的数组写回去：不写的话这个 key 会一直挂着一串只增不减的过期
    // 时间戳。裁剪是这一步真正的清理动作，判断只是顺带的。
    bucket.set(key, recent);
    return false;
  }

  recent.push(now);
  bucket.set(key, recent);

  // 这个 Map 只增不减 —— 每个 key 很小，但「很小」乘上注册用户数就不小了。
  // 扫一次的代价是 O(key 数)，而它只在 Map 涨到阈值以上时才发生，摊下来可以忽略。
  if (bucket.size > SWEEP_AT) {
    for (const [k, times] of bucket) {
      const kept = times.filter((at) => now - at < WINDOW_MS);
      if (kept.length === 0) bucket.delete(k);
      else bucket.set(k, kept);
    }
  }

  return true;
}

/** 添加好友的额度。被限流时**必须**用同一条统一文案答复，理由见上面。 */
export function consumeAddFriendAttempt(userId: string): boolean {
  return consumeAttempt(addFriendAttempts, userId, MAX_ADD_FRIEND_ATTEMPTS);
}

/** 改密码的额度。被限流时可以如实告诉调用方，理由见上面。 */
export function consumePasswordChangeAttempt(userId: string): boolean {
  return consumeAttempt(passwordAttempts, userId, MAX_PASSWORD_ATTEMPTS);
}
