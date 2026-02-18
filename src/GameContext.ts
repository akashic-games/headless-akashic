import type { DumpedPlaylog, RunnerPlayer, RunnerRenderingMode } from "@akashic/headless-driver";
import { PlayManager, RunnerManager, setSystemLogger } from "@akashic/headless-driver";
import { activePermission, EMPTY_V3_PATH, passivePermission } from "./constants";
import type { GameClientInstanceType } from "./GameClient";
import { GameClient } from "./GameClient";
import { DefaultLogger } from "./loggers/DefaultLogger";
import { VerboseLogger } from "./loggers/VerboseLogger";
import type { EngineVersions } from "./types";

export interface GameContextParameterObject {
	/**
	 * game.json のパス。
	 * 省略した場合、空のゲームコンテンツを起動する。詳細は README を参照のこと。
	 */
	gameJsonPath?: string;

	/**
	 * プレイログデータ。
	 */
	playlog?: DumpedPlaylog;

	/**
	 * 詳細な実行ログを出力するかどうか。
	 * 省略した場合は `false` 。
	 */
	verbose?: boolean;
}

export interface GameClientStartParameterObject {
	/**
	 * プレイヤー情報。
	 */
	player?: RunnerPlayer;

	/**
	 * ゲーム画面のレンダリングモード。`"canvas"` または `"none"` が指定できる。
	 * `"canvas"` を指定すると `getPrimarySurfaceCanvas()` によりゲーム画面の描画データが取得できるようになる。
	 * 初期値は `"none"` (ゲーム画面を描画しない)。
	 */
	renderingMode?: RunnerRenderingMode;

	/**
	 * `g.Game#external` に与えられる値。
	 */
	externalValue?: {
		[key: string]: any;
	};

	/**
	 * ゲーム起動引数。
	 */
	gameArgs?: any;
}

/**
 * ゲームのコンテキスト。
 * 一つのゲームに対して一つのみ存在する。
 */
export class GameContext<EngineVersion extends keyof EngineVersions = keyof EngineVersions> {
	protected params: GameContextParameterObject;
	protected playManager: PlayManager;
	protected runnerManager: RunnerManager;
	protected playId: string | null = null;

	constructor(params: GameContextParameterObject) {
		if (params.verbose) {
			setSystemLogger(new VerboseLogger());
		} else {
			setSystemLogger(new DefaultLogger());
		}
		this.params = { ...params };
		this.playManager = new PlayManager();
		this.runnerManager = new RunnerManager(this.playManager);
	}

	/**
	 * プレイを初期化したうえで GameClient を返す。
	 * playlog が与えられていたら passive の、そうでなければ active の GameClient を返す。
	 */
	async getGameClient(params: GameClientStartParameterObject = {}): Promise<GameClient<EngineVersion>> {
		if (this.playId != null) {
			await this.playManager.deletePlay(this.playId);
		}

		this.playId = await this.createPlay();

		const executionMode = this.params.playlog ? "passive" : ("active" satisfies GameClientInstanceType);
		const { runner, game } = await this.createRunner(params, executionMode);

		return new GameClient<EngineVersion>({ runner, game, type: executionMode, renderingMode: params.renderingMode });
	}

	/**
	 * passive の GameClient を生成する。
	 */
	async createPassiveGameClient(params: GameClientStartParameterObject = {}): Promise<GameClient<EngineVersion>> {
		if (this.playId == null) {
			this.playId = await this.createPlay();
		}

		const { runner, game } = await this.createRunner(params, "passive");

		return new GameClient<EngineVersion>({ runner, game, type: "passive", renderingMode: params.renderingMode });
	}

	/**
	 * GameContext を破棄する。
	 */
	async destroy(): Promise<void> {
		const { playManager, runnerManager, playId } = this;

		const runners = runnerManager.getRunners();
		for (let i = 0; i < runners.length; i++) {
			const runner = runners[i];
			runner.stop();
			runner.errorTrigger.remove(this.handleRunnerError, this);
		}

		if (playId) {
			await playManager.deletePlay(playId);
			this.playId = null;
		}
	}

	/**
	 * GameContext の状態を指定ミリ秒だけ進める。
	 * 本メソッドを利用した場合、経過中に発生したイベントは、この advance() の中では処理されないことに注意。
	 * 経過中に発生したイベントをフレームごとに処理したい場合は advanceEach() を利用すること。
	 * @param ms 進めるミリ秒
	 */
	async advance(ms: number): Promise<void> {
		const { runnerManager } = this;
		const runners = runnerManager.getRunners();
		for (const runner of runners) {
			await runner.advance(ms);
		}
	}

	/**
	 * GameContext の各インスタンスの処理を1フレームずつ、指定ミリ秒分だけ進める。
	 * @param ms 進めるミリ秒
	 */
	async advanceEach(ms: number): Promise<void> {
		const { runnerManager } = this;
		const runners = runnerManager.getRunners();

		const maxFps = runners.reduce((max, current) => (max < current.fps ? current.fps : max), 0);
		if (!maxFps) {
			throw new Error("Cannot call advanceEach() before starting");
		}

		const delta = 1000 / maxFps;
		let elapsed = 0;
		while (elapsed <= ms) {
			for (const runner of runners) {
				await runner.advance(delta);
			}
			elapsed += delta;
		}
	}

	/**
	 * GameContext の状態を一フレームだけ進める。
	 */
	async step(): Promise<void> {
		const { runnerManager } = this;
		const runners = runnerManager.getRunners();
		await Promise.allSettled(runners.map(runner => runner.step()));
	}

	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	protected async createRunner(params: GameClientStartParameterObject, executionMode: GameClientInstanceType) {
		const { playManager, runnerManager } = this;
		let { playId } = this;

		if (playId == null) {
			playId = await this.createPlay();
		}

		const permission = executionMode === "active" ? activePermission : passivePermission;
		const playToken = playManager.createPlayToken(playId, permission);
		const amflow = playManager.createAMFlow(playId);

		const runnerId = await runnerManager.createRunner({
			playId,
			amflow,
			playToken,
			player: params.player,
			executionMode,
			allowedUrls: null,
			trusted: true,
			renderingMode: params.renderingMode,
			externalValue: params.externalValue,
			gameArgs: params.gameArgs
		});

		const runner = runnerManager.getRunner(runnerId)!;
		const game = (await runnerManager.startRunner(runnerId)) as EngineVersions[EngineVersion]["game"];
		runner.errorTrigger.add(this.handleRunnerError, this);
		runner.pause();

		return { runner, game };
	}

	protected async createPlay(): Promise<string> {
		return this.playManager.createPlay(
			{
				gameJsonPath: this.params.gameJsonPath ?? EMPTY_V3_PATH
			},
			this.params.playlog
		);
	}

	protected handleRunnerError(err: any): void {
		if (err.code === "MODULE_NOT_FOUND" && /@napi-rs\/canvas/.test(err.message)) {
			console.error(`@napi-rs/canvas is required when "renderingMode" is set to "@napi-rs/canvas".`);
		} else if (err.code === "MODULE_NOT_FOUND" && /canvas/.test(err.message)) {
			console.error(`node-canvas is required when "renderingMode" is set to "canvas".`);
		}
		throw err;
	}
}
