# Donut Town：迁移到 DigitalOcean App Platform

适用于已有 Slack Bot、Google Sheet 和 Upstash 的 Town。迁移同一套服务，继续使用原数据库和原 Slack app。配置参考在 [`.do/app.yaml`](../.do/app.yaml)，其中的仓库名和空白密钥需要在控制台填好；文件不是 GitHub Actions，也不会因为存在就自动创建收费服务。

## 1. 创建一台 Web Service

打开 [DigitalOcean 控制台](https://cloud.digitalocean.com/apps) → Create → App Platform，连接自己的 GitHub 仓库和 `main` 分支。确认分支已经包含本次生产环境适配，再部署。只授予所需仓库访问权。

| 配置项 | 设置 |
| --- | --- |
| Resource type | Web Service，不是 Static Site |
| Source directory | 仓库根目录 `/` |
| Build command | `npm ci` |
| Run command | `npm start` |
| Instance | 512 MiB、1 shared vCPU、$5/月，`apps-s-1vcpu-0.5gb` |
| Containers | 1；当前在线人物同步保存在单进程中 |
| HTTP port | `8080` |
| HTTP route | `/` |
| Health check | `/api/health` |
| Autodeploy | 开启，从选定分支自动部署 |
| Region | 优先选靠近现有 Upstash 和主要用户的区域 |

不要创建新的数据库组件。原 Upstash 提供配对、钱包、家具等持久化数据。512 MiB 是起步配置，实际内存和并发容量需要上线后检查。

官方：[创建应用](https://docs.digitalocean.com/products/app-platform/how-to/create-apps/)、[实例价格](https://docs.digitalocean.com/products/app-platform/details/pricing/)、[配置规范](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)。

## 2. 填环境变量

在 Web Service 的 Environment Variables 中添加，作用域选 Runtime。下列普通值可以直接填：

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
PUBLIC_BASE_URL=${APP_URL}
SLACK_ALLOW_SEND=false
```

`${APP_URL}` 要原样填入 DigitalOcean 控制台，它会替换为新站点的 HTTPS 地址。不是放到本地 `.env.local` 中等待 Node 展开；本地检查时应使用真实新网址。也可把 `PUBLIC_BASE_URL` 设置为明确的 HTTPS 根地址，不带 `/auth/slack/start`。

[DigitalOcean 环境变量说明](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/)。

从 Render 的 Environment 原样复制下面的现有值，密钥和密码勾选 Encrypt；不要放入 Git 或聊天：

```text
SLACK_BOT_TOKEN
SLACK_SIGNING_SECRET
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
SLACK_CHANNEL_ID
STAGING_PASSWORD
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
LOTTERY_SYNC_SECRET
```

如果原服务还配有以下变量，也保留：

```text
PROFILE_API_URL
PROFILE_API_SECRET
TOWN_ADMIN_KEYS
SLACK_LEDGER_CHANNEL_ID
SESSION_DAYS
```

`PROFILE_API_URL` 指向原 Google Apps Script 的接口，不要改成小镇新域名。Apps Script Properties 中的 `SLACK_TOKEN`、`LOTTERY_SYNC_SECRET` 等保持原值。

尤其不要重新生成 `SLACK_SIGNING_SECRET`：人物标识和已有数据关联依赖它。`SLACK_CHANNEL_ID`、Upstash 数据库也保持一致。不要照搬旧的 `PUBLIC_BASE_URL`、`PORT` 或 Render 平台自带的 `RENDER*` 变量。

## 3. 部署并检查新地址

确认 Summary 只包含一台 $5 Web Service，没有另加数据库，点击 Create App。部署会产生费用。等待部署成功，复制 Overview 中实际生成的 `https://….ondigitalocean.app` 地址。

打开新地址的 `/api/health`，应返回 `ok: true`、`storage: true`。这里的 storage 只表示已填存储配置，不证明数据库可用。

新站点直接打开可能要求管理员预览密码：用户名 `donut`，密码为复制的 `STAGING_PASSWORD`。正常成员走 Slack 登录入口。暂时保留旧服务和旧配置用于回退。

## 4. 修改现有 Slack app 的两个地址

在 [Slack app 设置](https://api.slack.com/apps) 中打开原 Bot，保留现有 scopes 和其他功能，不要用新模板整体覆盖原 manifest。

| 设置位置 | 新值 |
| --- | --- |
| OAuth & Permissions → Redirect URLs | 添加 `https://新域名/auth/slack/callback`，保存；初期可保留旧回调 |
| Interactivity & Shortcuts → Request URL | 改为 `https://新域名/slack/interactions`，保存 |
| 成员入口、频道书签 | `https://新域名/auth/slack/start` |

按页面操作：

1. 在 Your Apps 中选当前 Donut Bot；用 Basic Information 的 Client ID 与原部署 `SLACK_CLIENT_ID` 核对，避免改错 app。
2. 左侧 **OAuth & Permissions** → **Redirect URLs** → **Add New Redirect URL**，填完整的 `/auth/slack/callback` 地址，点击 **Add**、**Save URLs**。
3. 左侧 **Interactivity & Shortcuts**，保持 Interactivity 为 **On**，将 **Request URL** 的旧 Render 地址替换为完整的 `/slack/interactions` 新地址，点击 **Save Changes**。这项只有一个目标地址，接受/拒绝邀请等按钮从此发到新服务。
4. **Basic Information** 中的 Client ID、Client Secret、Signing Secret 和 **OAuth & Permissions** 中的 Bot Token 保持原值；原 scopes、频道权限、app 安装也保留。仅调整这两个 URL 不需要为了迁移卸载重装；如果另改了 scopes，则按 Slack 提示重新授权。
5. 频道书签和旧消息入口改用 `/auth/slack/start`；这个成员入口既不是 Redirect URL，也不是 Interactivity Request URL。旧的接受/拒绝邀请按钮会走 app 的新 Request URL，但必须能在原 Upstash 中找到对应邀请。

官方：[登录回调](https://docs.slack.dev/authentication/sign-in-with-slack/)、[按钮交互回调](https://docs.slack.dev/interactivity/handling-user-interaction/)。

无需为这次迁移新增 Events API 或 Slash Command。已有报名帖中按钮和文字链接仍是旧地址，修改 Configs 不会追溯更新这些帖子。更新旧入口消息或提供新书签；不要为了换入口误运行 `postWeeklyDonutRoundManual()`，它会新建报名轮次。

换域名后浏览器 Cookie 不共用，成员需要在新网址重新登录。

## 5. Google Script 哪里改

匹配算法无需修改，也无需仅为迁移重新部署 Apps Script web app。

在 Google Sheet 的 `Configs` 表：

- `TOWN_URL` 改为 `https://新域名/auth/slack/start`。
- `CHANNEL_ID` 保持原值，必须等于新服务的 `SLACK_CHANNEL_ID`。
- `TOWN_SYNC_ENABLED` 最终设为 `TRUE`，但要先处理下面的停机期间配对核对。

如果停机期间设为 FALSE 并手动运行过抽签，本次结果只在 Sheet/Slack，**不会因为恢复 TRUE 自动补回小镇**。先核对 GuessWho、Slack 报名帖和本周 Town 配对；不要重抽、删除完成标记，或在数据未核对时开放新的真实邀请。可能存在 Town 已提交但 Sheet 尚未发布的结果，也需要核对。

完成核对后，在 App Platform 设 `SLACK_ALLOW_SEND=true`。在 Apps Script 中运行 **`checkTownPairingConnection`**：该函数只检查连接，不发消息、不抽签。它要求新后台启用发送配置。

检查 Apps Script 的 Triggers/Executions，确认原有 `donutAutomationTick` 每 15 分钟触发。触发器若还存在，无需重装；仅在缺失时运行 `setupDonutAutomation()`。恢复自动化可能处理积压的报名帖，先确认本轮记录再启用。

## 6. 测试顺序与验收

### 本地代码测试

```sh
node --test test/production-deploy.test.mjs test/deployment-tools.test.mjs test/apps-script-automation.test.mjs test/apps-script-pairing.test.mjs
npm test
```

需要 Redis 的集成测试只可连接隔离的 localhost 测试库，不使用生产 Upstash。默认 `npm test` 会跳过没有对应测试服务的案例，要区分执行与跳过。

### 部署后只读检查

本地 `.env.local` 或进程环境需要与新服务配置一致。更新本地 `PUBLIC_BASE_URL` 为实际新域名后执行：

```sh
npm run doctor -- --url https://新域名
npm run doctor -- --url https://新域名 --live
```

检查配置、Slack Bot 和频道访问、Redis PING、匿名成员接口返回 401、健康状态和 Slack 初始登录重定向。不发送消息、不写数据库，但不能证明完整 OAuth 和真实操作已经成功。

### 浏览器与业务检查

1. 从新入口完整登录，确认自己的名字、人物、装扮、钱包和 Home 与旧站记录一致。
2. 自己的 Home 移动一件装饰，刷新后确认保存；验证自己的数据写入。
3. 两个已同意测试的账号进入同一地图，确认移动可相互看见；验证代理和 WebSocket。
4. 完成本周配对核对后，先用自己的测试预览，再与同意测试的成员验证真实邀请、接受回调和 Bot 提示。真实接受会占用本周配对并发放奖励。
5. 运行 `checkTownPairingConnection()`，再看下一次自动触发是否成功。不要为了测试重跑已经完成的本周抽签。
6. 验证后更新所有入口，停用旧 Render 服务的自动部署并确认它保持暂停；不要让旧域名服务在下个账期自动恢复承接过时入口。

迁移失败时可以把 Slack 回调和 Configs.TOWN_URL 切回旧地址，但旧 Render 必须先恢复服务。不要创建空数据库或清空现有数据来尝试回退。
