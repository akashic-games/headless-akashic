import { DumpedPlaylog, PlayManager, RunnerManager, RunnerRenderingMode, setSystemLogger } from "@akashic/headless-driver";
import { activePermission, EMPTY_V3_PATH, passivePermission } from "./constants";
import { GameClient } from "./GameClient";
import { DefaultLogger } from "./loggers/DefaultLogger";
import { VerboseLogger } from "./loggers/VerboseLogger";
import { EngineVersions } from "./types";

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
	 * active の GameClient を返す。
	 */
	async getGameClient(params: GameClientStartParameterObject = {}): Promise<GameClient<EngineVersion>> {
		const { playManager, runnerManager } = this;
		const { gameJsonPath } = this.params;

		if (this.playId != null) {
			await this.playManager.deletePlay(this.playId);
		}

		const playId = await playManager.createPlay(
			{
				gameJsonPath: gameJsonPath ?? EMPTY_V3_PATH
			},
			this.params.playlog
		);
		this.playId = playId;

		const playToken = playManager.createPlayToken(playId, activePermission);
		const amflow = playManager.createAMFlow(playId);

		const runnerId = await runnerManager.createRunner({
			playId,
			amflow,
			playToken,
			executionMode: "active",
			allowedUrls: null,
			trusted: true,
			renderingMode: params.renderingMode,
			externalValue: params.externalValue
		});

		const runner = runnerManager.getRunner(runnerId)!;
		runner.errorTrigger.add(this.handleRunnerError, this);
		const game = (await runnerManager.startRunner(runnerId)) as EngineVersions[EngineVersion]["game"];
		runner.pause();

		const gameClient = new GameClient<EngineVersion>({ runner, game, type: "active", renderingMode: params.renderingMode });
		await gameClient.initialize();
		return gameClient;
	}

	/**
	 * passive の GameClient を生成する。
	 */
	async createPassiveGameClient(params: GameClientStartParameterObject = {}): Promise<GameClient<EngineVersion>> {
		const { playManager, runnerManager, playId } = this;

		if (playId == null) {
			throw new Error("Cannot create the client before starting");
		}

		const playToken = playManager.createPlayToken(playId, passivePermission);
		const amflow = playManager.createAMFlow(playId);

		const runnerId = await runnerManager.createRunner({
			playId,
			amflow,
			playToken,
			executionMode: "passive",
			allowedUrls: null,
			trusted: true,
			renderingMode: params.renderingMode,
			externalValue: params.externalValue
		});

		const runner = runnerManager.getRunner(runnerId)!;
		const game = (await runnerManager.startRunner(runnerId)) as EngineVersions[EngineVersion]["game"];
		runner.errorTrigger.add(this.handleRunnerError, this);
		runner.pause();

		const gameClient = new GameClient<EngineVersion>({ runner, game, type: "passive", renderingMode: params.renderingMode });
		await gameClient.initialize();
		return gameClient;
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
			playManager.deletePlay(playId);
			this.playId = null;
		}
	}

	/**
	 * GameContext の状態を指定ミリ秒だけ進める。
	 * @param ms 進めるミリ秒
	 */
	async advance(ms: number): Promise<void> {
		const { runnerManager } = this;
		const runners = runnerManager.getRunners();
		for (let i = 0; i < runners.length; i++) {
			await runners[i].advance(ms);
		}
	}

	/**
	 * GameContext の状態を一フレームだけ進める。
	 */
	step(): void {
		const { runnerManager } = this;
		const runners = runnerManager.getRunners();
		for (let i = 0; i < runners.length; i++) {
			runners[i].step();
		}
	}

	protected handleRunnerError(err: any): void {
		throw err;
	}
}
