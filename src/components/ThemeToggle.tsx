/** Light/dark switch; shows the icon of the theme you'd switch to. */

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle({ className }: { className?: string }) {
	const { resolved, toggle } = useTheme();
	const toLight = resolved === "dark";
	const label = toLight ? "Switch to light theme" : "Switch to dark theme";
	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label={label}
			title={label}
			onClick={toggle}
			className={className}
		>
			{toLight ? <Sun /> : <Moon />}
		</Button>
	);
}
