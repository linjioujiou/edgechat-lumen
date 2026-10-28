// 认证页曾依赖 Google Fonts 的书写体（Dancing Script / Great Vibes）。
// 新设计改用系统字体栈：首屏零外部字体请求，断网也不会出现字体跳变。
// 保留导出，避免调用方（含 Capacitor 壳）因缺少模块而报错。
export function loadAuthFonts() {}
