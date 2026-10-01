/** MVP 试玩版元信息 — 产品经理可改版本号与反馈渠道（勿扩账号系统） */
export const TRIAL_PLAY_VERSION = "0.3.0-day3";

/** 试玩反馈渠道：按优先级 formUrl → wechatId → email；均为空时菜单仍显示，点击会提示配置 */
export const TRIAL_FEEDBACK = {
  /** 外链表单（腾讯问卷等） */
  formUrl: "",
  /** 微信号（点击复制） */
  wechatId: "",
  /** 反馈邮箱（打开 mailto） */
  email: "",
  note: "请注明试玩版本与问题手数",
};
