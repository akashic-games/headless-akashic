import type { RunnerV1Game, RunnerV1_g, RunnerV2Game, RunnerV2_g, RunnerV3Game, RunnerV3_g } from "@akashic/headless-driver";

export interface EngineVersions {
	1: {
		g: typeof RunnerV1_g;
		game: RunnerV1Game;
	};
	2: {
		g: typeof RunnerV2_g;
		game: RunnerV2Game;
	};
	3: {
		g: typeof RunnerV3_g;
		game: RunnerV3Game;
	};
}
