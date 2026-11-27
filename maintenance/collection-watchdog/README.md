# Cloudflare 备用采集调度

这是独立于 GitHub `schedule` 的备用时钟，继续调用本仓库 `sync-votes.yml` 的 `workflow_dispatch`。不调用日报接口，也不读取订阅者、数据库或订阅频道配置。

## 运行规则

- UTC 每小时 07、22、37、52 分检查一次（北京时间同样每 15 分钟）。
- 使用 GitHub Jobs API 的真实步骤完成时间，复用 `lib/collection-health.ts` 的 strict-v2 / legacy aggregate 证据规则。投票、治理、国库单独保留成功时间。
- 任一源超过 45 分钟没有成功，或尚无可信成功记录时，检查是否存在运行中/排队任务；没有任务且距离上次尝试至少 30 分钟，才补触发 main。
- 在发送 dispatch 前先持久化尝试时间。超时或丢失响应仍保留冷却，不将 HTTP 接受或检查时间写成采集成功。既有 GitHub concurrency 继续处理原生与备用触发间的竞态。
- 任一源超过 90 分钟没有成功，或元数据读取连续失败 90 分钟，向指定私人 Telegram 告警。持续故障最多每 6 小时提醒一次，恢复后发送一次恢复通知。Telegram API 确认成功才记录投递成功。
- 正数 private chat ID 是强制要求，禁止使用订阅频道/群组 ID。公开 `/status` 仅返回公共采集元数据，没有公开触发接口。
- 单个 SQLite Durable Object 保存证据、尝试时间、告警状态与短租约，避免并发和 Worker 重启清空去重状态。Cloudflare SQLite Durable Objects 可用于 Free 计划；本实现不申请付费升级。

## 配置和发布

所有命令从仓库根目录执行，使用现有 `node_modules/.bin/wrangler`。

1. 发布含新输入字段的 GitHub 工作流；输入仅用于标记来源和关联 ID，不进入 shell。
2. `wrangler login` 登录目标 Cloudflare 账户，至少需 account:read、user:read、workers:write、workers_scripts:write。
3. `wrangler deploy -c maintenance/collection-watchdog/wrangler.jsonc`：发布暂停版本，没有 Cron，ACTIVE=false。
4. 创建 **fine-grained** GitHub PAT：仅选本仓库，Actions=Read and write，默认 Metadata=Read。不要复用本机 gh 的通用令牌。示例有效期 90 天，须在到期前轮换；不可在聊天、Git、命令参数或日志粘贴令牌。
5. 通过 Wrangler 的交互式 secret put 分别写入 GITHUB_TOKEN、TELEGRAM_BOT_TOKEN、TELEGRAM_CHAT_ID；Bot 应为专用私人运维机器人，用户需先 Start。使用本机安全输入框配置时，值仅通过子进程 stdin 直接送入 Cloudflare。
6. `wrangler deploy -c maintenance/collection-watchdog/wrangler.active.jsonc`：最后一步启用 ACTIVE 和每 15 分钟的 Cron。必须先确认三个 secret 名称均已配置。
7. 网站生产变量 COLLECTION_WATCHDOG_STATUS_URL 设置为该 Worker 的 `https://<worker>.<account>.workers.dev/status`，重新部署网站。只接受 HTTPS workers.dev /status，无 query、用户信息或重定向。

`/api/collection-health` 同时保留 GitHub 原生 schedule 时间和 Cloudflare 备用时钟。备用检查正常且三项真实采集均新鲜时，整体可显示 fresh；原生 schedule 的 stale 状态保持原样，不能宣称 GitHub 原生恢复。备用检查超过 30 分钟未更新或读取失败，不能掩盖原生缺口。

## 验收

先运行 `node --experimental-strip-types scripts/test-collection-watchdog.mjs`（完全离线，禁止真实发送），以及现有完整测试、类型检查、生产构建、Wrangler dry-run。

启用后应观察至少两个真实 Cron 窗口的 Cloudflare 日志/lastCheckAt、带 `Cloudflare collection watchdog` 标题的 Actions 记录和三项步骤的完成时间。没有过期数据时正常跳过；有数据变化与否不影响运行记录。不用人工 dispatch 或修改旧时间来满足验收。

故障时仍可能受 GitHub API、Runner 或来源服务不可用影响，本方案绕过的是原生 schedule 事件遗漏，不承诺来源永远可用。Worker 自身若停止，私人告警也可能无法发送，因此站点健康接口还独立核对 Worker heartbeat；每日健康审查应继续检查它。

## 暂停 / 回退

重新部署 `wrangler.jsonc` 即关闭 Cron 并设置 ACTIVE=false，保留证据与告警历史。网站删除 COLLECTION_WATCHDOG_STATUS_URL 后仍按原生调度监测。撤销 GitHub 专用 PAT、移除 Telegram secrets 可完全关闭对外权限，不改业务数据或订阅。

## macOS 安全配置助手

本项目的桌面维护环境可使用以下两个助手，无须在终端参数、聊天或文件中写入密钥：

```sh
python3 maintenance/collection-watchdog/configure-github-macos.py
python3 maintenance/collection-watchdog/bind-telegram-macos.py
```

前者用系统隐藏输入框将 GitHub 专用令牌直接通过 stdin 送入 Cloudflare。后者验证专用 Telegram Bot，打开带随机一次性参数的私人 Start 链接，只接受该参数对应的 private chat，直接保存两个 Telegram Secrets。两者都不发送测试消息；取消或验证失败不会输出密钥。Telegram 校验使用启用证书检查的系统 curl，并禁用个人 curl 配置；Token URL 只经 stdin 传入，不在进程参数中。

当前生产只读状态地址为 https://ckb-dao-collection-watchdog.jackylhh.workers.dev/status 。首次 Cron 传播最多可能需要 15 分钟；应等待真实窗口，不为验收人工触发。

运行时回归使用 `node scripts/test-watchdog-workerd.mjs`，在 workerd 内运行真实 Durable Object，但禁用外网并替换 GitHub 响应。Cloudflare 不支持 `redirect: error`；边缘请求必须使用 `manual` 并检查非 2xx 响应，拒绝重定向。状态接口在已有错误时最多每 5 分钟进行一次只读连接诊断，诊断时间单独返回，不改计划检查或采集成功时间。

计划处理器直接等待检查结果；读取、补触发或私人告警失败时，保留失败状态并抛出固定异常，不把应用失败吞成正常返回。此错误路径有独立离线回归。
