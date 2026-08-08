# DevEco Remote Bridge Protocol (v1)

桌面端 `packages/desktop/src/main/remote-bridge.ts` 与鸿蒙手机端 `deveco-code-mobile` App 之间的通信协议。

## 传输

- **协议**：HTTP/1.1，明文（局域网直连）
- **监听**：桌面端 `0.0.0.0:5757`（可用 `DEVECO_BRIDGE_PORT` 覆盖）
- **认证**：配对后 `Authorization: Bearer <token>`
- **CORS**：`*`（局域网内允许）

## 配对流程

1. 桌面端启动时生成 6 位数字 pair code，TTL 10 分钟
2. 桌面端在设置界面（或调用 IPC `remote-bridge-info`）显示：
   - `hostnames`：本机所有非回环 IPv4
   - `port`
   - `pairCode`
   - `pairUrls`：可编码成二维码，格式：`deveco-remote://pair?host=<ip>&port=<port>&code=<code>`
3. 手机端 `POST /bridge/pair` body：
   ```json
   { "code": "123456", "device": "Mate 80 Pro", "deviceId": "<uuid>",
     "osVersion": "HarmonyOS 7", "appVersion": "1.0.0", "protocolVersion": 2 }
   ```
   - `deviceId`：手机首次启动生成的随机 UUID，持久化于本机安全存储
4. 桌面端校验通过后：
   - 生成 24 字节 base64url token，TTL 30 天
   - **立即轮换 pair code**（防止重放）
   - **按 `deviceId` 将设备持久化到磁盘**（桌面重启后仍可恢复）
   - 返回 `{ "token": "...", "expiresAt": <ms>, "deviceId": "...", "protocol": 2 }`

## 设备自动重连

手机每次启动 / 回前台 / 网络恢复时，用已存的 `deviceId` + token 静默重连，无需再次扫码。

### `POST /bridge/reconnect`

```json
{ "deviceId": "<uuid>", "token": "<stored>", "deviceName": "Mate 80 Pro", "protocolVersion": 2 }
```

- 成功：刷新 token 过期时间，返回 `{ token, expiresAt, deviceId, protocol }`
- `401`：设备不存在或令牌不匹配 / 已过期 → 手机置「鉴权失败」，要求重新配对；**但手机绝不因一次失败删除 deviceId**

### `POST /bridge/heartbeat`

认证：`Authorization: Bearer <token>`。body 可空。用于刷新在线状态；任意认证请求都会顺带刷新 `lastSeenAt`。

### `POST /bridge/unpair`

认证：`Authorization: Bearer <token>`。用户主动取消配对时调用，桌面端删除该设备记录，手机清本地连接信息与 deviceId。

## 接口列表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/bridge/hello` | 否 | 探活/嗅探 |
| POST | `/bridge/pair` | 否 | 配对 |
| POST | `/bridge/reconnect` | 否 | 按 deviceId+token 静默重连 |
| POST | `/bridge/heartbeat` | 是 | 心跳，刷新在线状态 |
| POST | `/bridge/unpair` | 是 | 取消配对并删除设备记录 |
| GET | `/bridge/whoami` | 是 | 当前 token 信息 |
| GET | `/bridge/sessions` | 是 | 代理 sidecar `GET /session` |
| GET | `/bridge/sessions/:id/messages` | 是 | 代理 `GET /session/:id/message` |
| POST | `/bridge/sessions/:id/message` | 是 | 代理 `POST /session/:id/message` |
| GET | `/bridge/projects` | 是 | 代理 `GET /project` |
| GET | `/bridge/events` | 是 | 消息长轮询，见下 |
| GET | `/bridge/permissions` | 是 | 代理 `GET /permission`，待审批请求列表 |
| POST | `/bridge/permissions/:id/answer` | 是 | 代理 `POST /permission/:id/reply` |

### `GET /bridge/events`

查询参数：

- `session`：必填，会话 ID
- `since`：上一轮返回的 `latest`，默认 `0`
- `wait`：等待预算秒数，默认 `25`，取值范围 `1..55`

桌面端挂起请求直到该会话出现比 `since` 更新的消息，或预算耗尽，返回：

```json
{ "latest": 1754630000000, "messages": [] }
```

`messages` 为空表示本轮无变化，客户端应立即发起下一轮。客户端读超时须大于 `wait`。

### `POST /bridge/permissions/:id/answer`

body：`{ "reply": "once" | "always" | "reject", "message": "可选说明" }`

## 错误响应

```json
{ "error": "invalid_pair_code" }
```

常见 error 值：`invalid_body`, `invalid_pair_code`, `pair_code_expired`, `unauthorized`, `sidecar_not_ready`, `sidecar_unreachable`, `not_found`, `internal_error`。

## 后续演进

- 长轮询（`/bridge/events`）与权限审批端点已落地；WebSocket 流式推送仍待评估，落地前长轮询即为默认实时通道
