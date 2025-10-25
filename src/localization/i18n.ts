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
            "Enable and organize the destinations RushMeme launches after it captures a contract address.",
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
          notificationsTitle: "Notifications",
          notificationsDescription:
            "Decide when RushMeme should display OS notifications after an execution attempt.",
          notificationsToggleLabel: "Show notifications",
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
            description: "Fine-tune how RushMeme handles {{platform}}.",
            name: "Platform name",
            tokenType: "Token type",
            shortcut: "Shortcut",
            tokenUrlsTitle: "Token URLs",
            urlTemplates: "URL templates by chain",
            toggle: "Enable platform",
            urlHint: "Use {CA} where the contract address should appear.",
            cancel: "Cancel",
            save: "Save changes",
          },
          upgradeDialog: {
            title: "Upgrade to launch more platforms",
            description:
              "Free plan opens one platform at a time. Go Pro to launch multiple destinations instantly.",
          },
        },
        pro: {
          heading: "Upgrade to RushMeme Pro",
          subtitle:
            "Unlock zero-delay launches, unlimited templates, and priority support for desks that move fast.",
          priceLabel: "Launch price",
          priceValue: "0.01 BNB / lifetime license",
          devicesInfo:
            "Each serial supports 2 devices. Manage activations inside RushMeme.",
          featuresTitle: "Everything in Pro",
          featuresList: [
            "Zero-delay browser launches",
            "Launch unlimited platforms at once",
            "Unlimited platform templates & custom fields",
            "Clipboard validation with advanced heuristics",
            "Priority support within 24 hours",
            "Early access to workflow automation",
          ],
          serialTitle: "Have a serial key?",
          serialDescription: "Enter your key to activate Pro instantly.",
          serialPlaceholder: "XXXX-XXXX-XXXX-XXXX",
          serialHelper:
            "We’ll validate the key online. Make sure you’re connected.",
          actions: {
            purchase: "Purchase license",
            redeem: "Activate Pro",
          },
          supportTitle: "Need another payment method?",
          supportDescription:
            "Ping us via Telegram @RushMeme or email pro@rushmeme.app. We accept USDT, TON, and wire transfers.",
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
            "配置 RushMeme 捕获合约地址后要打开的平台，并调整它们的呈现方式。",
          addPlatform: "添加平台",
          templatesLabel: "内置模板",
          customPlatform: "自定义平台…",
          customPlatformName: "自定义平台",
          emptyPlatformsMessage: "尚未配置任何平台，请点击上方按钮添加。",
          executionCardTitle: "偏好设置",
          executionCardDescription:
            "设定标签页的启动延时，并决定 RushMeme 何时提醒团队。",
          browserDelayTitle: "浏览器启动延时",
          browserDelayDescription:
            "为打开浏览器标签设置延时。免费用户需等待计时完成，升级 Pro 后即可立刻打开。",
          browserDelayValue: "当前延时 {{value}} 毫秒",
          delayBadge: "升级 Pro 可享0延时启动",
          notificationsTitle: "通知提醒",
          notificationsDescription: "选择在执行成功或失败时是否展示系统通知。",
          notificationsToggleLabel: "开启系统通知",
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
            description: "调整 RushMeme 处理 {{platform}} 的方式。",
            name: "平台名称",
            tokenType: "代币类型",
            shortcut: "快捷键",
            tokenUrlsTitle: "代币 URL",
            urlTemplates: "不同链路的 URL 模板",
            toggle: "启用该平台",
            urlHint: "请在需要填入合约地址的位置使用 {CA}。",
            cancel: "取消",
            save: "保存修改",
          },
          upgradeDialog: {
            title: "升级 Pro 解锁多平台同时打开",
            description:
              "免费版一次只能打开一个平台。升级 Pro 后即可同时启动多个平台并享受零延时。",
          },
        },
        pro: {
          heading: "升级 RushMeme Pro",
          subtitle:
            "解锁零延时打开、多平台模板和优先客服，帮助高频交易团队更快完成验证。",
          priceLabel: "首发价格",
          priceValue: "0.01 BNB / 永久授权",
          devicesInfo: "每个序列号可绑定 2 台设备，可在 RushMeme 中管理。",
          featuresTitle: "Pro 版本包含",
          featuresList: [
            "零延时浏览器启动体验",
            "支持同时开启不限数量的平台",
            "无限平台模板与自定义字段",
            "高级剪贴板校验与格式识别",
            "24 小时内优先客服响应",
            "抢先体验自动化工作流功能",
          ],
          serialTitle: "已有序列号？",
          serialDescription: "输入序列号即可立即激活 Pro 功能。",
          serialPlaceholder: "XXXX-XXXX-XXXX-XXXX",
          serialHelper: "激活时需要联网，请确保网络可用。",
          actions: {
            purchase: "购买授权",
            redeem: "立即激活",
          },
          supportTitle: "需要其他支付方式？",
          supportDescription:
            "欢迎通过 Telegram @RushMeme 或发送邮件到 pro@rushmeme.app；支持 USDT、TON 以及银行转账。",
        },
      },
    },
  },
});
