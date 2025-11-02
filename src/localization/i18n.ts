import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        appName: "Rush Meme",
        titleHomePage: "Platform Configuration",
        titleSecondPage: "Upgrade to Pro",
        buttons: {
          upgrade: "Upgrade to Pro",
          purchase: "Purchase license",
          redeem: "Activate Pro",
          cancel: "Cancel",
          save: "Save changes",
        },
        footer: {
          newVersionBadge: "New version",
          versionDialogTitle: "New version available",
          versionDialogDescription: "Version {{version}} is ready to download.",
          versionDialogGeneric: "A newer version is available.",
          versionDialogNotesTitle: "Release notes",
          versionDialogDownloadHint: "We'll download the {{platform}} build.",
          downloadButtonLabel: "Download update",
          downloadUnavailable:
            "No compatible download link is available for this device.",
          closeButtonLabel: "Close",
        },
        common: {
          tokenType: "Token type",
          shortcut: "Shortcut",
          urlTemplate: "URL template",
          enabled: "Enabled",
          disabled: "Disabled",
        },
        home: {
          heading: "Rush Meme",
          subtitle:
            "Select any contract address and open your trading platform instantly. Stay one step ahead, strike first.",
          platformListTitle: "Platform shortcuts",
          platformListDescription:
            "Enable and organize the destinations Rush Meme launches after it captures a contract address.",
          addPlatform: "Add platform",
          templatesLabel: "Preset platforms",
          customPlatform: "Custom platform…",
          customPlatformName: "Custom platform",
          emptyPlatformsMessage:
            "No platform shortcuts configured yet. Use the button above to add one.",
          executionCardTitle: "Preferences",
          executionCardDescription:
            "Control how quickly browser tabs fire and when notifications keep the desk in sync.",
          browserDelayTitle: "Browser launch delay",
          browserDelayDescription:
            "Define a delay before opening browser tabs; free users wait for the countdown, while Pro users launch instantly.",
          browserDelayValue: "{{value}} ms delay",
          delayBadge: "Instant for Pro",
          proExpiresTomorrow: "Expires tomorrow",
          smartChainCorrectionTitle: "Smart chain correction",
          smartChainCorrectionDescription:
            "Double-checks the detected chain against opened URLs and nudges the right destination when they mismatch.",
          smartChainCorrectionToggleLabel: "Enable smart correction",
          notificationsTitle: "Notifications",
          notificationsDescription:
            "Decide when Rush Meme should display OS notifications after an execution attempt.",
          notificationsToggleLabel: "Show notifications",
          excludedAppsTitle: "Excluded applications",
          excludedAppsDescription:
            "Skip Rush Meme when these apps are the active window. Matches are case-insensitive.",
          excludedAppsToggleLabel: "Enable",
          excludedAppsToggleDescription: "",
          excludedAppsPlaceholder: "App name or bundle identifier…",
          excludedAppsAddButton: "Add",
          excludedAppsEmpty: "No apps excluded yet.",
          excludedAppsRemoveLabel: "Remove {{app}} from excluded apps",
          includedAppsTitle: "Allowed applications",
          includedAppsDescription:
            "Only run Rush Meme when these apps are the active window. Matches are case-insensitive.",
          includedAppsToggleLabel: "Enable",
          includedAppsToggleDescription: "",
          includedAppsPlaceholder: "App name or bundle identifier…",
          includedAppsAddButton: "Add",
          includedAppsEmpty: "No apps in the allowlist yet.",
          includedAppsRemoveLabel: "Remove {{app}} from allowed apps",
          applicationFiltersConflictTitle: "Confirm change",
          applicationFiltersConflictDescription: {
            include:
              "Enabling the application allowlist will automatically disable excluded apps.",
            exclude:
              "Enabling excluded apps will automatically disable the application allowlist.",
          },
          applicationFiltersConflictConfirm: "Continue",
          applicationFiltersConflictCancel: "Cancel",
          shortcutPlaceholder: "Press keys to capture…",
          shortcutConflictHint: "Also assigned to: {{platforms}}",
          statusTitle: "Autosave status",
          status: {
            saving: "Saving changes…",
            saved: "All changes saved",
            failed: "Save failed",
          },
          platformCard: {
            tokenTypeLabel: "Token type",
            shortcutLabel: "Shortcut",
            urlsLabel: "URL templates",
            helper: "Use {CA} as the placeholder for the contract address.",
            proTag: "Pro",
            customTag: "Custom",
            delete: "Delete",
          },
          dialog: {
            title: "Platform settings",
            description: "Fine-tune how Rush Meme handles {{platform}}.",
            name: "Platform name",
            tokenType: "Token type",
            shortcut: "Shortcut",
            tokenUrlsTitle: "Token URLs",
            urlTemplates: "URL templates by chain",
            toggle: "Enable platform",
            removeTokenType: "Remove token type",
            urlHint: "Use {{placeholder}} where the {{target}} should appear.",
            urlHintTargetContract: "contract address",
            urlHintTargetAny: "selected text",
            cancel: "Cancel",
            save: "Save changes",
            addTokenType: "+ Add token type",
            deleteConfirmTitle: "Delete this platform?",
            deleteConfirmDescription:
              "This action cannot be undone. The platform and its shortcuts will be removed from your configuration.",
            deleteConfirmCancel: "Cancel",
            deleteConfirmAction: "Delete",
          },
          upgradeDialog: {
            multiPlatform: {
              title: "Upgrade to launch more platforms",
              description:
                "Free plan opens one platform at a time. Go Pro to launch multiple platforms together with zero wait.",
            },
            advancedConfig: {
              title: "Upgrade to unlock advanced configuration",
              description:
                "Go Pro to add more token types, manage excluded apps, and remove launch delays altogether.",
            },
          },
          licenseErrorDialog: {
            title: "License validation failed",
            description:
              "Rush Meme could not reach the license server. Restore your connection and retry to keep Pro features active.",
            retry: "Retry validation",
            dismiss: "Dismiss",
            genericMessage: "Unable to validate the license right now.",
          },
        },
        pro: {
          heading: "Upgrade to Rush Meme Pro",
          subtitle:
            "Unlock zero-delay launches, unlimited templates, and priority support so your desk moves faster.",
          priceLabel: "Launch price",
          priceValue: "16 USDT / limited lifetime license",
          devicesInfo:
            "Includes future feature updates. Each key activates 1 device.",
          featuresTitle: "Everything in Pro",
          featuresList: [
            "Zero-delay browser launches",
            "Launch unlimited platforms at once",
            "Configure excluded apps or an allowlist",
            "Priority support within 24 hours",
            "Early access to the latest features",
          ],
          serialTitle: "Have a serial key?",
          serialDescription: "Enter your key to activate Pro instantly.",
          serialPlaceholder: "XXXX-XXXX-XXXX-XXXX",
          serialHelper:
            "We’ll validate the key online. Make sure you’re connected.",
          serialSuccess: "Pro activated!",
          serialDate: "Your Pro license is valid until {{date}}.",
          serialDataForever: "Your Pro license is lifetime.",
          actions: {
            purchase: "Purchase license",
            redeem: "Activate Pro",
            removeDevice: "Remove device binding",
          },
          supportTitle: "Need another payment method?",
          supportDescription:
            "We default to crypto payments. Need something else? Email support@rush meme.vip — we accept PayPal, bank transfer, Alipay, WeChat Pay, and PromptPay.",
          serialRequired: "Enter your license key to activate.",
          errors: {
            unavailable: "Activation service unavailable.",
            activationFailed: "Unable to activate. Please try again.",
            deactivationFailed:
              "Unable to remove activation. Please try again.",
            activationLimitReached:
              "Activation limit reached. Remove another device then try again.",
          },
        },
      },
    },
    "zh-CN": {
      translation: {
        appName: "Rush Meme",
        titleHomePage: "平台配置",
        titleSecondPage: "升级至 Pro",
        buttons: {
          upgrade: "升级到 Pro",
          purchase: "购买授权",
          redeem: "激活 Pro",
          cancel: "取消",
          save: "保存修改",
        },
        footer: {
          newVersionBadge: "发现新版本",
          versionDialogTitle: "发现新版本",
          versionDialogDescription: "版本 {{version}} 已可下载。",
          versionDialogGeneric: "检测到更高版本。",
          versionDialogNotesTitle: "更新说明",
          versionDialogDownloadHint: "将下载 {{platform}} 安装包。",
          downloadButtonLabel: "立即下载",
          downloadUnavailable: "当前设备暂未提供匹配的下载链接。",
          closeButtonLabel: "关闭",
        },
        common: {
          tokenType: "代币类型",
          shortcut: "快捷键",
          urlTemplate: "URL 模板",
          enabled: "已启用",
          disabled: "已禁用",
        },
        home: {
          heading: "Rush Meme",
          subtitle:
            "一键选中合约地址，瞬间打开交易平台，让你快人一步，抢先出击。",
          platformListTitle: "平台快捷方式",
          platformListDescription:
            "配置 Rush Meme 捕获合约地址后要打开的平台，并调整它们的呈现方式。",
          addPlatform: "添加平台",
          templatesLabel: "内置模板",
          customPlatform: "自定义平台…",
          customPlatformName: "自定义平台",
          emptyPlatformsMessage: "尚未配置任何平台，请点击上方按钮添加。",
          executionCardTitle: "偏好设置",
          executionCardDescription:
            "设定标签页的启动延时，并决定 Rush Meme 何时提醒团队。",
          browserDelayTitle: "浏览器启动延时",
          browserDelayDescription:
            "为打开浏览器标签设置延时。免费用户需等待计时完成，升级 Pro 后即可立刻打开。",
          browserDelayValue: "当前延时 {{value}} 毫秒",
          delayBadge: "升级 Pro 享 0 延时",
          proExpiresTomorrow: "明日到期",
          smartChainCorrectionTitle: "智能公链纠正",
          smartChainCorrectionDescription:
            "自动检测 CA 所属公链，校验是否为已开启 URL，不一致时打开正确 URL。",
          smartChainCorrectionToggleLabel: "启用",
          notificationsTitle: "通知提醒",
          notificationsDescription: "选择在执行成功或失败时是否展示系统通知。",
          notificationsToggleLabel: "开启系统通知",
          excludedAppsTitle: "忽略应用",
          excludedAppsDescription:
            "当前窗口属于以下应用时，Rush Meme 将忽略快捷键（不区分大小写）。",
          excludedAppsToggleLabel: "启用",
          excludedAppsToggleDescription: "",
          excludedAppsPlaceholder: "应用名称或 Bundle ID…",
          excludedAppsAddButton: "添加",
          excludedAppsEmpty: "尚未排除任何应用。",
          excludedAppsRemoveLabel: "从排除列表移除 {{app}}",
          includedAppsTitle: "应用白名单",
          includedAppsDescription:
            "仅当前台窗口匹配列表中的应用时才执行 Rush Meme（不区分大小写）。",
          includedAppsToggleLabel: "启用",
          includedAppsToggleDescription: "",
          includedAppsPlaceholder: "应用名称或 Bundle ID…",
          includedAppsAddButton: "添加",
          includedAppsEmpty: "白名单中暂无应用。",
          includedAppsRemoveLabel: "从白名单移除 {{app}}",
          applicationFiltersConflictTitle: "确认切换",
          applicationFiltersConflictDescription: {
            include: "启用应用白名单将自动关闭忽略应用。",
            exclude: "启用忽略应用将自动关闭应用白名单。",
          },
          applicationFiltersConflictConfirm: "继续",
          applicationFiltersConflictCancel: "取消",
          shortcutPlaceholder: "按下组合键…",
          shortcutConflictHint: "重复平台：{{platforms}}",
          statusTitle: "自动保存状态",
          status: {
            saving: "正在保存修改…",
            saved: "所有修改已保存",
            failed: "保存失败",
          },
          platformCard: {
            tokenTypeLabel: "代币类型",
            shortcutLabel: "快捷键",
            urlsLabel: "按链路设置 URL 模板",
            helper: "在模板中使用 {CA} 作为合约地址占位符。",
            proTag: "Pro",
            customTag: "自定义",
            delete: "删除",
          },
          dialog: {
            title: "平台设置",
            description: "调整 Rush Meme 处理 {{platform}} 的方式。",
            name: "平台名称",
            tokenType: "代币类型",
            shortcut: "快捷键",
            tokenUrlsTitle: "代币 URL",
            urlTemplates: "不同链路的 URL 模板",
            toggle: "启用该平台",
            removeTokenType: "移除该代币类型",
            urlHint: "请在需要填入{{target}}的位置使用 {{placeholder}}。",
            urlHintTargetContract: "合约地址",
            urlHintTargetAny: "选中文本",
            cancel: "取消",
            save: "保存修改",
            addTokenType: "+ 添加 token type",
            deleteConfirmTitle: "确定要删除这个平台吗？",
            deleteConfirmDescription:
              "此操作无法撤销，平台及其快捷键都会从配置中移除。",
            deleteConfirmCancel: "取消",
            deleteConfirmAction: "删除",
          },
          upgradeDialog: {
            multiPlatform: {
              title: "升级 Pro 解锁多平台同时打开",
              description:
                "免费版一次只能打开一个平台。升级 Pro 后即可同时启动多个平台并享受零延时。",
            },
            advancedConfig: {
              title: "升级后解锁高级配置",
              description:
                "升级 Pro 后即可新增更多 token 类型、管理排除应用，并享受零延时启动。",
            },
          },
          licenseErrorDialog: {
            title: "授权验证失败",
            description:
              "Rush Meme 无法连接授权服务器，请检查网络或稍后再试，以继续使用 Pro 功能。",
            retry: "重新验证",
            dismiss: "稍后再试",
            genericMessage: "当前无法验证授权。",
          },
        },
        pro: {
          heading: "升级 Rush Meme Pro",
          subtitle:
            "解锁零延时打开、多平台模板和优先客服，以最快的速度开始交易。",
          priceLabel: "首发价格",
          priceValue: "16 USDT / 限时永久授权",
          devicesInfo: "包含后续功能更新，每个序列号可绑定 1 台设备。",
          featuresTitle: "Pro 版本包含",
          featuresList: [
            "零延时浏览器启动体验",
            "支持同时开启不限数量的平台",
            "启用忽略应用或应用白名单",
            "24 小时内优先客服响应",
            "抢先体验最新功能",
          ],
          serialTitle: "已有序列号？",
          serialDescription: "输入序列号即可立即激活 Pro 功能。",
          serialPlaceholder: "XXXX-XXXX-XXXX-XXXX",
          serialHelper: "激活时需要联网，请确保网络可用。",
          serialSuccess: "激活成功！",
          serialDate: "您的 Pro 授权有效期至 {{date}}。",
          serialDataForever: "您的 Pro 授权为永久授权。",
          actions: {
            purchase: "购买授权",
            redeem: "立即激活",
            removeDevice: "移除设备绑定",
          },
          supportTitle: "需要其他支付方式？",
          supportDescription:
            "默认使用加密货币支持，如需其它支付方式，欢迎邮件联系 support@rush meme.vip。支持 PayPal、银行卡转账、支付宝、微信支付、PromptPay。",
          serialRequired: "请输入授权序列号后再激活。",
          errors: {
            unavailable: "激活服务暂不可用。",
            activationFailed: "激活失败，请稍后再试。",
            deactivationFailed: "解除绑定失败，请稍后再试。",
            activationLimitReached:
              "激活额度已用尽，请解除其他设备绑定后再试。",
          },
        },
      },
    },
  },
});
