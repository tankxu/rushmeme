import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeConfigContext } from "./config/config-context";
import { exposeShellContext } from "./shell/shell-context";
import { exposeLanguageContext } from "./language/language-context";
import { exposeLicenseContext } from "./license/license-context";
import { exposeAppContext } from "./app/app-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeConfigContext();
  exposeShellContext();
  exposeLanguageContext();
  exposeLicenseContext();
  exposeAppContext();
}
