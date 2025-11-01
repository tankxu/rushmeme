# License Worker API 列表

## 基础信息

- 基础路径：`/v1`
- 响应格式：JSON，默认携带 `Cache-Control: no-store`
- 时间戳：均为毫秒级 Unix 时间
- 中文字段说明仅供参考，真实响应以实际字段为准

## 认证说明

- 管理端接口：请求头 `x-api-key: <管理端密钥>`（通过 `wrangler secret put X_API_KEY` 配置）
- 客户端接口：请求头 `x-license-key: <具体授权密钥>`（需与 URL 中的 `license_key` 一致）

---

## 健康检查

- `GET /healthz`
- 无需认证，用于确认 Worker 正常运行。

**示例响应**

```json
{
  "status": "ok",
  "timestamp": 1718000000000
}
```

---

## 授权（管理端）

### 列表查询

- `GET /v1/licenses`
- Headers：`x-api-key`
- Query 参数：
  - `status`（可选）：`active`/`suspended`/`expired`/`revoked`
  - `search`（可选）：模糊匹配授权密钥、`issued_to` 或 `user_email`
  - `page`（默认 1）
  - `page_size`（默认 25，最大 100）

返回列表中的每条授权记录均包含 `user_email` 字段，便于按用户聚合。

**示例**

```bash
curl -i "http://localhost:8787/v1/licenses?page=1&page_size=25" \
  -H "x-api-key: <你的管理密钥>"
```

### 创建授权

- `POST /v1/licenses`
- Headers：`Content-Type: application/json` + `x-api-key`

**请求体字段**

```json
{
  "issued_to": "Team QA Laptop",
  "max_activations": 2,
  "metadata": { "note": "内测渠道" },
  "expires_at": 1735689600000,
  "user_email": "qa@example.com"
}
```

**成功响应（201）**

```json
{
  "license_key": "Rush-Meme-1A2B-3C4D-5E6F-7G8H",
  "status": "active",
  "issued_to": "Team QA Laptop",
  "user_email": "qa@example.com",
  "max_activations": 2,
  "metadata": { "note": "内测渠道" },
  "created_at": 1717286400000,
  "updated_at": 1717286400000,
  "expires_at": 1735689600000
}
```

### 查看授权详情

- `GET /v1/licenses/{license_key}`
- Headers：`x-api-key`
- 返回授权信息及当前激活列表。响应中包含 `user_email` 字段标记授权所属邮箱，激活记录包含 `platform`、`app_version`、`os_version` 等设备信息。

### 更新授权

- `PATCH /v1/licenses/{license_key}`
- Headers：`Content-Type: application/json` + `x-api-key`
- 支持字段：`status`、`issued_to`、`metadata`、`max_activations`、`expires_at`、`user_email`
- 成功返回 `204 No Content`

### 用户列表

- `GET /v1/users`
- Headers：`x-api-key`
- Query 参数：
  - `search`（可选）：按邮箱模糊匹配
  - `page`（默认 1）
  - `page_size`（默认 25，最大 100）

**响应示例**

```json
{
  "items": [
    {
      "email": "user@example.com",
      "created_at": 1717286400000,
      "license_count": 3
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 1
}
```

### 用户详情

- `GET /v1/users/{email}`
- Headers：`x-api-key`
- 用途：查看某个邮箱用户的基础信息及关联的序列号列表。

**响应示例**

```json
{
  "email": "user@example.com",
  "created_at": 1717286400000,
  "license_count": 3,
  "licenses": [
    {
      "license_key": "Rush-Meme-1A2B-3C4D-5E6F-7G8H",
      "status": "active",
      "issued_to": null,
      "user_email": "user@example.com",
      "max_activations": 1,
      "activation_count": 0,
      "metadata": null,
      "created_at": 1717286400000,
      "updated_at": 1717286400000,
      "expires_at": null
    }
  ]
}
```

### 用户创建

- `POST /v1/users`
- Headers：`Content-Type: application/json` + `x-api-key`
- 用途：预先创建一个用户邮箱，初始化时可复用。

**请求体**

```json
{
  "email": "user@example.com"
}
```

**成功响应（201 新建 / 200 已存在）**

```json
{
  "email": "user@example.com",
  "created_at": 1717286400000,
  "license_count": 0,
  "created": true
}
```

### 用户初始化

- `POST /v1/users/init`
- Headers：`Content-Type: application/json` + `x-api-key`
- 用途：一次性创建用户并生成一个授权序列号。

**请求体**

```json
{
  "email": "user@example.com",
  "license": {
    "issued_to": "User Laptop",
    "max_activations": 1,
    "metadata": { "channel": "beta" },
    "expires_at": null
  }
}
```

---

## 客户端版本

### 查询最新版本（客户端）

- `GET /v1/app/latest`
- Query 参数：
  - `channel`（可选，默认 `stable`）：版本通道标记，例如 `stable`、`beta`

**成功响应（示例）**

```json
{
  "channel": "stable",
  "version": "1.2.3",
  "download_urls": {
    "windows": "https://example.com/client-1.2.3-win.exe",
    "mac": "https://example.com/client-1.2.3-mac.dmg"
  },
  "notes": "优化性能，修复若干问题",
  "force_update": false,
  "min_supported_version": "1.1.0",
  "created_at": 1718000000000,
  "updated_at": 1718000000000
}
```

若未配置对应通道版本信息，返回 `404 not_found`。

### 配置最新版本（管理端）

- `PUT /v1/app/latest`
- Headers：`Content-Type: application/json` + `x-api-key`
- Query 参数：
  - `channel`（可选，默认 `stable`），若请求体包含 `channel` 字段，则以请求体为准

**请求体字段**

```json
{
  "version": "1.2.3",
  "notes": "优化性能",
  "force_update": false,
  "min_supported_version": "1.1.0",
  "download_urls": {
    "windows": "https://example.com/client-1.2.3-win.exe",
    "mac": "https://example.com/client-1.2.3-mac.dmg"
  }
}
```

`download_urls` 为必填对象，键为平台标识（例如 `windows` / `mac` / `linux`），值为对应下载地址。

**成功响应（200）**

```json
{
  "channel": "stable",
  "version": "1.2.3",
  "download_urls": {
    "windows": "https://example.com/client-1.2.3-win.exe"
  },
  "notes": "优化性能",
  "force_update": false,
  "min_supported_version": "1.1.0",
  "created_at": 1718000000000,
  "updated_at": 1718000000000
}
```

---

## 外部数据代理

### Token 信息查询（客户端）

- `GET /v1/ave/tokens?keyword={CA}`
- Headers：`x-license-key`
- 用途：代理请求 `https://prod.ave-api.com/v2/tokens?keyword={CA}`，仅返回结果中的链信息。
- 频率限制：同一 `license_key` 每分钟最多 10 次，超出返回 `429 rate_limited`。命中 Worker 缓存（缓存期约 6 个月）时不会再次访问上游。

**成功响应示例**

```json
{
  "keyword": "0xeca1c3dde449fd83c748f9fb017da17459d84444",
  "chains": ["bsc"],
  "source": "upstream",
  "fetched_at": 1761978000000
}
```

`source` 字段为 `cache` 时表示命中了 Worker 缓存，`X-Proxy-Cache` 响应头同样会标记 `HIT/MISS`。如果 Worker 未配置 `AVE_API_KEY` 或上游返回异常，将响应 `502 upstream_error`。

`license` 字段可选，若省略则默认创建 `max_activations = 1`、`expires_at = null` 的授权。

**成功响应（201）**

```json
{
  "user": {
    "email": "user@example.com",
    "created_at": 1717286400000,
    "license_count": 1,
    "created": true
  },
  "license": {
    "license_key": "Rush-Meme-1A2B-3C4D-5E6F-7G8H",
    "status": "active",
    "issued_to": "User Laptop",
    "user_email": "user@example.com",
    "max_activations": 1,
    "metadata": { "channel": "beta" },
    "created_at": 1717286400000,
    "updated_at": 1717286400000,
    "expires_at": null
  }
}
```

---

### 序列号分发

- `POST /v1/users/distribute`
- Headers：`Content-Type: application/json` + `x-api-key`
- 用途：为指定邮箱批量生成序列号，并通过 Resend 发送邮件。

**请求体**

```json
{
  "email": "user@example.com",
  "count": 2,
  "license": {
    "issued_to": "User Laptop",
    "max_activations": 1,
    "metadata": { "channel": "beta" },
    "expires_at": null
  }
}
```

- `licenses` 字段（可选）支持直接传入序列号配置数组，若指定则忽略 `count` 和 `license`。
- 不填写 `issued_to` 时默认留空，`max_activations` 默认为 1，`expires_at` 默认为永久。
- `count` 最大 20。

**成功响应（201）**

```json
{
  "user": {
    "email": "user@example.com",
    "created_at": 1717286400000,
    "license_count": 3,
    "created": false
  },
  "licenses": [
    {
      "license_key": "Rush-Meme-1A2B-3C4D-5E6F-7G8H",
      "status": "active",
      "issued_to": "User Laptop",
      "user_email": "user@example.com",
      "max_activations": 1,
      "metadata": { "channel": "beta" },
      "created_at": 1717286400000,
      "updated_at": 1717286400000,
      "expires_at": null
    }
  ],
  "email_sent": true
}
```

调用成功后会立刻通过 Resend 将生成的序列号发送到目标邮箱。

---

## 激活与验证（客户端）

### 设备激活

- `POST /v1/licenses/{license_key}/activations`
- Headers：`Content-Type: application/json` + `x-license-key`

**请求体**

```json
{
  "device_id": "hardware-hash",
  "app_version": "1.1.0",
  "platform": "win",
  "os_version": "Windows 11 23H2"
}
```

字段说明：

- `device_id`：必填，唯一标识设备。
- `app_version`：可选，客户端版本。
- `platform`：可选，平台类型（如 `win`、`mac`）。
- `os_version`：可选，操作系统版本，比如 `Windows 11 23H2`。

**成功响应（201）**

```json
{
  "status": "accepted",
  "activation_id": 42,
  "remaining_slots": 0,
  "message": "激活成功"
}
```

**常见错误**

- `409 activation_limit_reached`：激活额度已满
- `403 license_revoked`：授权被撤销或暂停

### 验证 / 心跳

- `POST /v1/licenses/{license_key}/validate`
- Headers：`Content-Type: application/json` + `x-license-key`
- 请求体与激活相同（携带 `device_id`、`app_version`、`platform`）

**成功响应**

```json
{
  "status": "active",
  "allowed": true,
  "message": "授权有效",
  "max_activations": 2,
  "activations_used": 1,
  "expires_at": 1735689600000,
  "next_check_in": 86400
}
```

**常见错误**

- `403 activation_required`：设备未激活
- `409 activation_limit_reached`：设备未激活且额度满
- `403 activation_blocked`：该设备激活被管理员标记为阻止

### 撤销激活

- `POST /v1/licenses/{license_key}/activations/{device_id}/deactivate`
- Headers：`x-license-key`
- 成功返回 `204 No Content`
- 常见错误：
  - `404 activation_not_found`
  - `403 activation_blocked`

### 管理端移除激活

- `DELETE /v1/licenses/{license_key}/activations/{device_id}`
- Headers：`x-api-key`
- 用途：在管理后台手动移除某设备的激活记录，设备需重新激活后才能继续使用。
- 成功返回 `204 No Content`
- 常见错误：
  - `404 license_not_found`
  - `404 activation_not_found`
  - `403 activation_blocked`

---

## 错误格式

所有错误响应统一为：

```json
{
  "error": {
    "code": "error_code",
    "message": "人类可读描述"
  }
}
```

其中 `code` 用于客户端判断具体错误场景，例如：

- `missing_api_key`
- `invalid_license_key`
- `license_revoked`
- `activation_limit_reached`
- `activation_required`
