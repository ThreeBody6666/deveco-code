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
3. 手机端 `POST /bridge/pair` body：`{ "code": "123456", "device": "HarmonyOS" }`
4. 桌面端校验通过后：
   - 生成 24 字节 base64url token，TTL 30 天
   - **立即轮换 pair code**（防止重放）
   - 返回 `{ "token": "...", "expiresAt": <ms> }`

## 接口列表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/bridge/hello` | 否 | 探活/嗅探 |
| POST | `/bridge/pair` | 否 | 配对 |
| GET | `/bridge/whoami` | 是 | 当前 token 信息 |
| GET | `/bridge/sessions` | 是 | 代理 sidecar `GET /session` |
| GET | `/bridge/sessions/:id/messages` | 是 | 代理 `GET /session/:id/message` |
| POST | `/bridge/sessions/:id/message` | 是 | 代理 `POST /session/:id/message` |
| GET | `/bridge/projects` | 是 | 代理 `GET /project` |

## 错误响应

```json
{ "error": "invalid_pair_code" }
```

常见 error 值：`invalid_body`, `invalid_pair_code`, `pair_code_expired`, `unauthorized`, `sidecar_not_ready`, `sidecar_unreachable`, `not_found`, `internal_error`。

## 后续演进

- v2 计划加 WebSocket 流式推送会话事件（替代 5s 轮询）
- v2 计划加权限审批端点（`GET /bridge/permissions`, `POST /bridge/permissions/:id/answer`）
