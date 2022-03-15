import type { SystemLogger } from "@akashic/headless-driver";

export class DefaultLogger implements SystemLogger {
	info(..._messages: any[]): void {
		// console.log(...messages);
	}
	debug(..._messages: any[]): void {
		// console.log(...messages);
	}
	warn(..._messages: any[]): void {
		// console.warn(...messages);
	}
	error(...messages: any[]): void {
		console.error(...messages);
	}
}
