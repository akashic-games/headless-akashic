import { RunnerV1, RunnerV1Game, RunnerV2, RunnerV2Game, RunnerV3, RunnerV3Game } from "@akashic/headless-driver";
import type { RunnerAdvanceConditionFunc, RunnerRenderingMode } from "@akashic/headless-driver";
import type { ResourceFactory as ResourceFactoryV1 } from "@akashic/headless-driver/lib/runner/v1/platform/ResourceFactory";
import type { ResourceFactory as ResourceFactoryV2 } from "@akashic/headless-driver/lib/runner/v2/platform/ResourceFactory";
import type { NodeCanvasResourceFactory as ResourceFactoryV3_NodeCanvas } from "@akashic/headless-driver/lib/runner/v3/platform/NodeCanvasResourceFactory";
import type { NullResourceFactory as ResourceFactoryV3_Null } from "@akashic/headless-driver/lib/runner/v3/platform/NullResourceFactory";
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

	private resourceFactoryClassV1: typeof ResourceFactoryV1;
	private resourceFactoryClassV2: typeof ResourceFactoryV2;
	private resourceFactoryClassV3: typeof ResourceFactoryV3_NodeCanvas | typeof ResourceFactoryV3_Null;

	/**
	 * 初期化処理
	 */
	async initialize(): Promise<void> {
		// canvas を利用しない場合でも静的 import だと NodeCanvasResourceFactory で canvas を参照するので動的 import とする
		const resfV1 = await import("@akashic/headless-driver/lib/runner/v1/platform/ResourceFactory");
		const resfV2 = await import("@akashic/headless-driver/lib/runner/v2/platform/ResourceFactory");
		this.resourceFactoryClassV1 = resfV1.ResourceFactory;
		this.resourceFactoryClassV2 = resfV2.ResourceFactory;

		if (this.renderingMode === "canvas") {
			const nodeCanvasResf = await import("@akashic/headless-driver/lib/runner/v3/platform/NodeCanvasResourceFactory");
			this.resourceFactoryClassV3 = nodeCanvasResf.NodeCanvasResourceFactory;
		} else {
			const nullResf = await import("@akashic/headless-driver/lib/runner/v3/platform/NullResourceFactory");
			this.resourceFactoryClassV3 = nullResf.NullResourceFactory;
		}
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
		const resFac = this.runner.platform.getResourceFactory();
		const id = param.id ?? uuid.v4();
		const path = param.path ?? uuid.v4();

		if (resFac instanceof this.resourceFactoryClassV1) {
			return resFac.createImageAsset(id, path, param.width, param.height);
		} else if (resFac instanceof this.resourceFactoryClassV2) {
			return resFac.createImageAsset(id, path, param.width, param.height);
		} else if (resFac instanceof this.resourceFactoryClassV3) {
			return resFac.createImageAsset(id, path, param.width, param.height);
		}

		throw Error("GameClient#createAudioAsset(): Could not create a image asset");
	}

	/**
	 * ダミーの AudioAsset を生成する。
	 * @param param AudioAsset の生成に必要なパラメータ。
	 */
	createDummyAudioAsset(param: GameClientCreateAudioAssetParameterObject): any {
		const resFac = this.runner.platform.getResourceFactory();
		const id = param.id ?? uuid.v4();
		const path = param.path ?? uuid.v4();
		const loop = !!param.loop;

		if (resFac instanceof this.resourceFactoryClassV1) {
			const game = this.game as RunnerV1Game;
			const system = param.systemId ? game._audioSystemManager[param.systemId] : game._audioSystemManager[game.defaultAudioSystemId];
			return resFac.createAudioAsset(id, path, param.duration, system, loop, param.hint);
		} else if (resFac instanceof this.resourceFactoryClassV2) {
			const game = this.game as RunnerV2Game;
			const system = param.systemId ? game._audioSystemManager[param.systemId] : game._audioSystemManager[game.defaultAudioSystemId];
			return resFac.createAudioAsset(id, path, param.duration, system, loop, param.hint);
		} else if (resFac instanceof this.resourceFactoryClassV3) {
			const game = this.game as RunnerV3Game;
			const system = param.systemId ? game.audio[param.systemId] : game.audio[game.defaultAudioSystemId];
			return resFac.createAudioAsset(id, path, param.duration, system, loop, param.hint);
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
