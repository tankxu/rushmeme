# Backlog

## 安全问题

这里目前最容易被绕过授权的点有几处：

src/helpers/ipc/config/config-context.ts:18-34、src/helpers/ipc/config/config-listeners.ts:712-725、src/helpers/ipc/license/license-store.ts:139-196、src/helpers/ipc/license/license-service.ts:331-376：前端可以直接把伪造的 license 写回 rushConfig.saveConfig，主进程会照单全收并持久化，还会先行把 Pro 打开，再去验证。攻击者只要把状态伪造为 active，然后把网络断掉，就能一直保持 Pro。建议把许可证状态做成只读字段，所有写操作都通过专门的 IPC（激活、验证等）走主进程逻辑，并且忽略/拒绝 saveConfig 里传进来的 license 字段。

src/helpers/ipc/license/pro-status.ts:3-69：设置环境变量 RUSHMEME_PRO / RUSHMEME_IS_PRO / RUSHMEME_LICENSE_TIER=pro 会直接把 Pro 打开。任何人只要带着这些环境变量启动打包好的 App，就等于免授权。至少要限制为开发模式才允许，或者彻底删除这些 override。

src/helpers/ipc/license/license-client.ts:114-118：RUSHMEME_LICENSE_BASE_URL 可以重定向到假服务器，返回永远 allowed: true。如果这个变量在生产包里仍然可用，攻击者本地起个服务就能伪造授权。建议生产环境固定域名并做证书校验，环境变量只在 dev 测试使用。

src/helpers/ipc/license/license-store.ts:134-196、src/helpers/ipc/license/license-service.ts:331-376：授权信息保存在明文 license.dat，启动时只要文件里是 status: "active" 就会立刻启用 Pro，验证结果（如果被防火墙/hosts 拦住）不会更新这个状态。攻击者可直接放一个伪造文件，再阻断所有验证请求。需要增加完整性保护（例如加签/加密或使用系统钥匙串），并在主进程确认远程验证成功之前不允许进入 Pro 状态。

建议优先落实这些修复，再补充：1）主进程封死所有非授权字段的写权限；2）移除对环境变量和 Base URL 的生产逃生口；3）给 license.dat 增加签名或强制每次验证成功才标记激活。完成后重新测试，确保这些手动绕过方式都失效。

## 问题列表

- 启动延时开了 pro 后还是不能修改
- Pro 升级页面内容和布局
- 平台展示里面没有显示 base 的url
- 托盘里面没有显示第二个 token type
