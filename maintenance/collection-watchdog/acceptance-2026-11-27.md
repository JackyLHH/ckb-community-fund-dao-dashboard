# 2026-11-27 上线验收（北京时间）

## 实际结果

- 16:52 首次真实 Cron 已执行，但请求在 Cloudflare 运行时因不支持 `redirect: error` 而失败；未触发 GitHub，未推进成功时间。此记录保留。
- 已改为 `manual` 并拒绝所有非 2xx 响应，同时加入 workerd/Miniflare 的真实运行时隔离回归。诊断仅验证连接，不更新计划检查时间。
- 17:07:11 Cloudflare 真实计划检查发现源过期，自动发起 `cf-1795770431107`。没有人工 dispatch。
- [GitHub 运行 45971042797](https://github.com/JackyLHH/ckb-community-fund-dao-dashboard/actions/runs/45971042797)的事件为 `workflow_dispatch`，标题为 `Cloudflare collection watchdog cf-1795770431107`，结论 success。
- 三项真实成功时间：投票 17:08:25；治理 17:08:27；国库 17:08:30。strict-v2 步骤证据均为 success，最终失败检查为 skipped。
- 治理日志确认 Twine #11228 依据提案人撤回声明跳过当前资格判断，历史点赞证据保留，未编造截止赞数或投票结果。
- 17:22:10 第二个健康 Cron 窗口返回 fresh。lastDispatchAt 仍为 17:07:11，没有重复触发。
- 私人 Telegram 的真实过期告警与恢复通知均获得 API 成功确认；未发送测试消息、未更改公共订阅频道或历史日报记录。API 确认不代表用户客户端已读。

## 网站和权限

生产状态地址：https://ckb-dao-collection-watchdog.jackylhh.workers.dev/status

网站 `/api/collection-health` 已返回 fresh、effectiveSchedule=cloudflare-watchdog，三项成功时间与上列步骤一致；原生 scheduleState 仍为 stale，原生最后运行仍为 12:38，未标为原生调度已恢复。

GitHub 专用凭据、独立 Telegram Bot Token、private chat ID 仅存于 Cloudflare Secrets；本文件不包含值。private chat 通过带随机参数的用户 Start 消息绑定。公开 POST /tick 返回 404。

原生调度和 16:00 日报保留。后续每 15 分钟检查；45 分钟过期且无排队/运行时补触发；尝试后冷却 30 分钟；90 分钟过期私人告警，持续故障提醒间隔 6 小时。凭据到期前须轮换，停止方法参见同目录 README。
