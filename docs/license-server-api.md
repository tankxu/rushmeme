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
  - `search`（可选）：模糊匹配授权密钥或 `issued_to`
  - `page`（默认 1）
  - `page_size`（默认 25，最大 100）

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
  "expires_at": 1735689600000
}
```

**成功响应（201）**

```json
{
  "license_key": "Rush-Meme-1A2B-3C4D-5E6F-7G8H",
  "status": "active",
  "issued_to": "Team QA Laptop",
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
- 返回授权信息及当前激活列表。激活记录包含 `platform`、`app_version`、`os_version` 等设备信息。

### 更新授权

- `PATCH /v1/licenses/{license_key}`
- Headers：`Content-Type: application/json` + `x-api-key`
- 支持字段：`status`、`issued_to`、`metadata`、`max_activations`、`expires_at`
- 成功返回 `204 No Content`

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
