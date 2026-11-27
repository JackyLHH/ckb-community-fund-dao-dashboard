import subprocess,re,json,secrets,time
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
script='text returned of (display dialog "请粘贴专用于私人运维告警的 Telegram Bot Token。不要使用订阅频道机器人的密钥。接下来会打开你的机器人，请点击 Start。" default answer "" with hidden answer buttons {"取消", "继续"} default button "继续" with title "DAO 备用调度 · 绑定私人 Telegram")'
r=subprocess.run(['osascript','-e',script],capture_output=True,text=True)
if r.returncode:raise SystemExit('Local Telegram setup cancelled')
token=r.stdout.strip()
if not re.fullmatch(r'[0-9]+:[A-Za-z0-9_-]+',token):raise SystemExit('Bot token format invalid; no value stored')
def api(method):
 # curl uses the system's trusted certificate configuration. The secret URL
 # is supplied through stdin, never through argv or diagnostics output.
 config='url = "https://api.telegram.org/bot'+token+'/'+method+'"\nsilent\nshow-error\nconnect-timeout = 10\nmax-time = 20\nwrite-out = "\\n%{http_code}"\n'
 result=subprocess.run(['curl','-q','--config','-'],input=config,capture_output=True,text=True)
 if result.returncode:raise SystemExit('Telegram HTTPS connection unavailable; no value printed')
 content,_,status=result.stdout.rpartition('\n')
 if status!='200':raise SystemExit('Telegram API returned HTTP '+status+'; no value printed')
 try:body=json.loads(content)
 except Exception:raise SystemExit('Invalid Telegram response; no value printed')
 if body.get('ok') is not True:raise SystemExit('Telegram verification failed; no value printed')
 return body['result']
bot=api('getMe');name=bot.get('username','')
if not re.fullmatch(r'[A-Za-z0-9_]+',name):raise SystemExit('Invalid bot identity')
nonce='dao_'+secrets.token_urlsafe(18)
subprocess.run(['open','https://t.me/'+name+'?start='+nonce],check=True)
print('Telegram bot opened. Click Start to bind your private chat.',flush=True)
chat=None
for attempt in range(120):
 updates=api('getUpdates?timeout=0')
 for update in updates:
  msg=update.get('message',{});candidate=msg.get('chat',{})
  if msg.get('text')=='/start '+nonce and candidate.get('type')=='private' and isinstance(candidate.get('id'),int) and candidate['id']>0:chat=candidate['id'];break
 if chat:break
 time.sleep(5)
if not chat:raise SystemExit('Private chat binding timed out; no secrets stored')
for key,value in [('TELEGRAM_BOT_TOKEN',token),('TELEGRAM_CHAT_ID',str(chat))]:
 r=subprocess.run([str(repo/'node_modules/.bin/wrangler'),'secret','put',key,'--config',str(repo/'maintenance/collection-watchdog/wrangler.jsonc')],input=value+'\n',text=True,capture_output=True,cwd=repo)
 if r.returncode:raise SystemExit('Cloudflare secret upload failed; no value printed')
print('Private Telegram securely bound; no test message sent.')
