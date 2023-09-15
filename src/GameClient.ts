import { RunnerV3 } from "@akashic/headless-driver";
import type {
	RunnerAdvanceConditionFunc,
	RunnerRenderingMode,
	RunnerV1,
	RunnerV1Game,
	RunnerV2,
	RunnerV2Game,
	RunnerV3Game
} from "@akashic/headless-driver";
import type { Canvas } from "canvas";
import * as uuid from "uuid";
import type { EngineVersions } from "./types";

type Runner = RunnerV1 | RunnerV2 | RunnerV3;

export type GameClientInstanceType = "active" | "passive";

export interface GameClientParameterObject<EngineVersion extends keyof EngineVersions = keyof EngineVersions> {
	runner: Runner;
	game: EngineVersions[EngineVersion]["game"];
	type: GameClientInstanceType;
	renderingMode: RunnerRenderingMode;
}

export interface GameClientCreateImageAssetParameterObject {
	id?: string;
	path?: string;
	width: number;
	height: number;
}

export interface GameClientCreateAudioAssetParameterObject {
	id?: string;
	path?: string;
	duration: number;
	systemId?: string;
	loop?: boolean;
	hint?: any;
}

/**
 * ゲームクライアント。
 */
export class GameClient<EngineVersion extends keyof EngineVersions = keyof EngineVersions> {
	/**
	 * `g.game` の値。
	 */
	readonly game: EngineVersions[EngineVersion]["game"];

	/**
	 * ゲームインスタンスの種別。
	 */
	readonly type: GameClientInstanceType;

	/**
	 * `g` の値。 `g.game` は `undefined` である点に注意。
	 */
	readonly g: EngineVersions[EngineVersion]["g"];

	protected runner: Runner;
	protected renderingMode: RunnerRenderingMode;

	constructor({ runner, game, type, renderingMode }: GameClientParameterObject<EngineVersion>) {
		this.runner = runner;
		this.game = game;
		this.type = type;
		this.renderingMode = renderingMode;
		this.g = runner.g;
	}

	/**
	 * 任意の g.PointDownEvent を送信する。
	 *
	 * @param x x座標
	 * @param y y座標
	 * @param identifier ポイントを識別するためのID
	 */
	sendPointDown(x: number, y: number, identifier: number): void {
		this.runner.firePointEvent({
			type: "down",
			identifier,
			offset: {
				x,
				y
			}
		});
	}

	/**
	 * 任意の g.PointMoveEvent を送信する。
	 *
	 * @param x x座標
	 * @param y y座標
	 * @param identifier ポイントを識別するためのID
	 */
	sendPointMove(x: number, y: number, identifier: number): void {
		this.runner.firePointEvent({
			type: "move",
			identifier,
			offset: {
				x,
				y
			}
		});
	}

	/**
	 * 任意の g.PointUpEvent を送信する。
	 *
	 * @param x x座標
	 * @param y y座標
	 * @param identifier ポイントを識別するためのID
	 */
	sendPointUp(x: number, y: number, identifier: number): void {
		this.runner.firePointEvent({
			type: "up",
			identifier,
			offset: {
				x,
				y
			}
		});
	}

	/**
	 * 任意の g.MessageEvent を送信する。
	 * @param message メッセージ
	 * @param playerId プレイヤーID
	 */
	sendMessage(message: any, playerId?: string): void {
		this.runner.amflow.sendEvent([0x20, 0, playerId, message]);
	}

	/**
	 * ゲームの描画内容を取得し、そのデータを取得する。
	 */
	getPrimarySurfaceCanvas(): Canvas {
		const mode = this.renderingMode;

		if (mode === "canvas") {
			if (this.runner instanceof RunnerV3) {
				return this.runner.getPrimarySurfaceCanvas();
			}
			throw new Error("GameClient#getPrimarySurface(): renderingMode 'canvas' is only supported on akashic-engine@^3.0.0");
		}

		throw new Error(`GameClient#getPrimarySurface(): renderingMode "${mode}" is not supported`);
	}

	/**
	 * ダミーの ImageAsset を生成する。
	 * @param param ImageAsset の生成に必要なパラメータ。
	 */
	createDummyImageAsset(param: GameClientCreateImageAssetParameterObject): any {
		const id = param.id ?? uuid.v4();
		const path = param.path ?? uuid.v4();
		const version = this.runner.engineVersion;

		if (version === "1") {
			const game = this.game as RunnerV1Game;
			return game.resourceFactory.createImageAsset(id, path, param.width, param.height);
		} else if (version === "2") {
			const game = this.game as RunnerV2Game;
			return game.resourceFactory.createImageAsset(id, path, param.width, param.height);
		} else if (version === "3") {
			const game = this.game as RunnerV3Game;
			return game.resourceFactory.createImageAsset(id, path, param.width, param.height);
		}

		throw Error("GameClient#createAudioAsset(): Could not create a image asset");
	}

	/**
	 * ダミーの AudioAsset を生成する。
	 * @param param AudioAsset の生成に必要なパラメータ。
	 */
	createDummyAudioAsset(param: GameClientCreateAudioAssetParameterObject): any {
		const id = param.id ?? uuid.v4();
		const path = param.path ?? uuid.v4();
		const loop = !!param.loop;

		const version = this.runner.engineVersion;
		if (version === "1") {
			const game = this.game as RunnerV1Game;
			const system = param.systemId ? game._audioSystemManager[param.systemId] : game._audioSystemManager[game.defaultAudioSystemId];
			return game.resourceFactory.createAudioAsset(id, path, param.duration, system, loop, param.hint);
		} else if (version === "2") {
			const game = this.game as RunnerV2Game;
			const system = param.systemId ? game._audioSystemManager[param.systemId] : game._audioSystemManager[game.defaultAudioSystemId];
			return game.resourceFactory.createAudioAsset(id, path, param.duration, system, loop, param.hint);
		} else if (version === "3") {
			const game = this.game as RunnerV3Game;
			const system = param.systemId ? game.audio[param.systemId] : game.audio[game.defaultAudioSystemId];
			return game.resourceFactory.createAudioAsset(id, path, param.duration, system, loop, param.hint);
		}

		throw Error("GameClient#createAudioAsset(): Could not create a audio asset");
	}

	/**
	 * 引数に指定した関数が真を返すまでゲームの状態を進める。
	 * @param condition 進めるまでの条件となる関数。
	 * @param timeout タイムアウトまでのミリ秒数。省略時は `5000` 。ゲーム内時間ではなく実時間である点に注意。
	 */
	async advanceUntil(condition: RunnerAdvanceConditionFunc, timeout: number = 5000): Promise<void> {
		return this.runner.advanceUntil(condition, timeout);
	}
}
