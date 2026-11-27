import subprocess,re,sys
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
name='GITHUB_TOKEN'
if name not in ['GITHUB_TOKEN','TELEGRAM_BOT_TOKEN']:raise SystemExit(2)
message={'GITHUB_TOKEN':'请粘贴刚创建的 GitHub 专用令牌。仅用于 ckb-community-fund-dao-dashboard 的 Actions。令牌将直接保存到 Cloudflare，不进入聊天。','TELEGRAM_BOT_TOKEN':'请粘贴专用于私人运维告警的 Telegram Bot Token。不要使用订阅频道的机器人密钥。令牌将直接保存到 Cloudflare。'}[name]
script='text returned of (display dialog "'+message+'" default answer "" with hidden answer buttons {"取消", "保存"} default button "保存" with title "DAO 采集备用调度 · 安全配置")'
r=subprocess.run(['osascript','-e',script],capture_output=True,text=True)
if r.returncode:raise SystemExit('Local credential entry cancelled')
secret=r.stdout.strip()
pattern=r'github_pat_[A-Za-z0-9_]+' if name=='GITHUB_TOKEN' else r'[0-9]+:[A-Za-z0-9_-]+'
if not re.fullmatch(pattern,secret):raise SystemExit('Credential format invalid; value was not stored')
r=subprocess.run([str(repo/'node_modules/.bin/wrangler'),'secret','put',name,'--config',str(repo/'maintenance/collection-watchdog/wrangler.jsonc')],input=secret+'\n',text=True,capture_output=True,cwd=repo)
# Wrangler output can contain account metadata; do not expose the token or raw errors.
if r.returncode:raise SystemExit('Cloudflare secret upload failed; no value printed')
print(name+' safely stored in Cloudflare')
