import type { SystemLogger } from "@akashic/headless-driver";

export class VerboseLogger implements SystemLogger {
	info(...messages: any[]): void {
		console.log(...messages);
	}
	debug(...messages: any[]): void {
		console.log(...messages);
	}
	warn(...messages: any[]): void {
		console.warn(...messages);
	}
	error(...messages: any[]): void {
		console.error(...messages);
	}
}
