import * as path from "path";
import type { Permission } from "@akashic/amflow";

export const activePermission: Permission = {
	readTick: true,
	writeTick: true,
	sendEvent: true,
	subscribeEvent: true,
	subscribeTick: true,
	maxEventPriority: 2
};

export const passivePermission: Permission = {
	readTick: true,
	writeTick: false,
	sendEvent: true,
	subscribeEvent: true,
	subscribeTick: true,
	maxEventPriority: 2
};

export const EMPTY_V3_PATH: string = path.join(__dirname, "..", "fixtures", "empty-v3", "game.json");
