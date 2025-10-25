# RushMeme 客户端授权接入方案

本文档描述本地 Electron 客户端在集成 License Worker API (`license-worker.tankxu.workers.dev`) 时的整体设计、模块划分以及关键交互流程，便于后续开发与维护。

## 1. 角色与术语

- **License Worker**：部署在 Cloudflare Workers 上的授权服务端，提供激活与验证接口。
- **Main Process**：Electron 主进程，负责与 License Worker 通信、管理授权状态。
- **Renderer/UI**：前端界面，展示授权状态并收集用户输入。
- **License Store**：本地保存授权密钥及状态的配置仓库（基于 `src/helpers/ipc/config`）。

## 2. 模块划分

1. **License API Client（主进程）**
   - 基于 `fetch` 或 `node-fetch` 封装 Worker API 调用。
   - 统一设置 `Cache-Control: no-store`、`Content-Type: application/json`，并附带 `x-license-key` 或 `x-api-key` 请求头。
   - 标准化响应：解析 `version`、`status`、`allowed` 等字段，对错误码进行分类处理。

2. **License Service（主进程）**
   - 对外暴露激活、验证、心跳调度、撤销等方法。
   - 维护内存态（当前授权状态、下次心跳时间、剩余激活额度等）。
   - 负责调度周期性心跳（默认 24h，可配置）。

3. **IPC 渠道（主进程 ↔ Renderer）**
   - 新增 `license:*` 通道用于：
     - 读取当前授权状态。
     - 提交/更新授权密钥。
     - 手动触发激活、验证、注销。
   - 所有操作统一返回 Promise，附带错误码与文案。

4. **Renderer 层组件**
   - 在设置页提供授权管理区块（输入密钥、查看状态、手动刷新或注销）。
   - 使用状态上下文/Store（如 Zustand）接收主进程推送的状态更新。
   - 将错误码映射为用户友好的提示文案。

## 3. 数据持久化与安全

- 授权密钥存储位置：复用 `config-store`（`src/helpers/ipc/config/config-store.ts`），键名建议为 `license.key`。
- 存储格式：纯文本或简单加密（目前方案为纯文本，如需加密可接入 OS Keychain）。
- 状态缓存：在 `config-store` 中存 `license.status`、`license.expires_at` 等字段，用于离线展示。
- 读取策略：
  1. 启动时同步读取配置。
  2. 如果缓存中存在有效状态但离线，仍允许进入 UI，等待下一次心跳后更新。

## 4. 授权生命周期

### 4.1 首次输入密钥

1. Renderer 收到用户输入的密钥，发起 `license.submit` IPC。
2. Main Process 执行：
   - 将密钥写入配置并刷新内存态。
   - 调用 `POST /v1/licenses/{license_key}/activations` 进行激活。
   - 成功：返回 `status: accepted`、更新 `remaining_slots`，写入 `license.status = active`。
   - 失败：回滚配置中密钥，向 Renderer 返回错误码（`invalid_license_key`、`activation_limit_reached` 等）。
3. 校验为有效的密钥后，为客户端开启 Pro 功能。

### 4.2 客户端启动流程

1. 主进程启动后读取配置，如果存在 `license.key`：
   - 若本地标记为未激活：立即执行激活流程。
   - 若已激活：调用 `POST /v1/licenses/{license_key}/validate`。
2. 根据验证结果：
   - `allowed: true` → 更新状态/到期时间，并根据 `next_check_in` 设置心跳定时器。
   - `allowed: false` → 将状态标记为异常（例如 `suspended`、`revoked`、`activation_required`），通知 Renderer 在 UI 中使用弹窗显示 license 失效，引导用户重新输入 license。同时关闭客户端 Pro 功能。

### 4.3 心跳调度

- 默认间隔：根据服务端返回的 `next_check_in`（秒）设置，若缺失则使用 86400 秒（24h）。
- 定时器在 `BrowserWindow` 关闭时仍运行（主进程负责）。
- 失败重试：采用指数退避（例如 15s → 60s → 5min），避免瞬时网络波动导致频繁报错。
- 连续多次失败后（例如 >24h），Renderer 显示「心跳超时」提示，并建议用户检查网络或重新验证。

### 4.4 手动撤销/更换设备

1. Renderer 触发 `license.deactivate(deviceId)` 或直接删除密钥。
2. Main Process 调用 `POST /v1/licenses/{license_key}/activations/{device_id}/deactivate`。
3. 成功后清空本地密钥，通知 UI 回到未授权状态，关闭客户端 Pro 功能。

## 5. 错误处理与提示

| Worker 错误码                                 | 场景               | 客户端处理                      |
| --------------------------------------------- | ------------------ | ------------------------------- |
| `missing_license_key` / `invalid_license_key` | 请求缺少或格式不对 | 清空本地密钥，提示用户重新输入  |
| `license_revoked` / `license_suspended`       | 授权被暂停或撤销   | UI 显示阻塞状态，引导联系管理员 |
| `activation_limit_reached`                    | 激活额度已满       | 提示用户在旧设备中注销后再试    |
| `activation_required`                         | 尚未激活           | 引导执行激活流程                |
| `activation_blocked`                          | 设备被管理员阻止   | 提示联系管理员                  |
| `rate_limited`                                | 超出限流           | 退避后自动重试，UI 显示短暂提示 |

> 建议在 `License Service` 中统一转换错误码，Renderer 仅关心通用状态（`active`、`blocked`、`network_error` 等）。

## 6. UI/UX 指引

- 设置页展示：
  - 许可证密钥输入框（仅在未激活或管理员允许时可编辑）。
  - 状态徽标：`Active`、`Suspended`、`Revoked`、`Pending`。
  - 到期时间（永久的license显示永久有效）、剩余激活数。
  - 手动按钮：`立即验证`，有 license 就提供文本按钮 `撤销当前设备`。
- 密钥验证通过后，Upgrade to pro 的按钮文案改为 Pro，开启 Pro 功能
- 当状态变为 `revoked`/`suspended` 时，主界面弹窗通知 license 失效，引导用户重新输入 license。关闭客户端 Pro 功能。

## 7. 集成步骤清单

1. **实现 License API Client**：`src/helpers/ipc/license/license-client.ts`（新建）。
2. **实现 License Service**：`src/helpers/ipc/license/license-service.ts`，负责激活、验证、心跳调度。
3. **注册 IPC 通道**：在 `src/helpers/ipc/listeners-register.ts` 中添加 `license` 相关 listener，并在 `context-exposer.ts` 暴露给 Renderer。
4. **配置存储扩展**：更新 `config.ts`/`default-config.ts`，新增 `license` 字段。
5. **Renderer 状态管理**：新增 `license-store` 或在现有 store 中扩展授权状态。
6. **UI 改造**：完善状态细节。
7. **启动钩子**：在 `main.ts` 或启动流程中加载 License Service，完成首次验证并启动心跳。
8. **测试**：先不做测试
   - 单元：mock fetch，覆盖激活、验证、错误分支。
   - 集成：通过 Playwright/E2E 模拟输入密钥、状态变化。
   - 手动：连接 staging Worker，验证激活→心跳→撤销完整流程。

---

如需进一步细化接口实现或错误码映射，可在 `docs` 目录补充 API 对照表与状态机图。
