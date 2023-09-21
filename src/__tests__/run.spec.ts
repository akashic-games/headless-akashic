import * as path from "path";
import { GameContext } from "..";

const gameJsonPath = path.resolve(__dirname, "fixtures", "helloworld", "game.json");

describe("run content", () => {
	it("empty content", async () => {
		const context = new GameContext<3>({});
		const activeClient = await context.getGameClient();
		const game = activeClient.game;
		expect(game.width).toBe(1280);
		expect(game.height).toBe(720);
		expect(game.fps).toBe(60);
	});

	it("create assets", async () => {
		const context = new GameContext<3>({});
		const activeClient = await context.getGameClient();

		const imageAsset = activeClient.createDummyImageAsset({
			id: "dummy-image-asset-id",
			path: "dummy-image-asset-path",
			width: 150,
			height: 107
		});
		expect(imageAsset.id).toBe("dummy-image-asset-id");
		expect(imageAsset.path).toBe("dummy-image-asset-path");
		expect(imageAsset.width).toBe(150);
		expect(imageAsset.height).toBe(107);

		const imageAssetNonIdPath = activeClient.createDummyImageAsset({
			width: 200,
			height: 120
		});
		expect(imageAssetNonIdPath.id).toBeDefined();
		expect(imageAssetNonIdPath.path).toBeDefined();
		expect(imageAssetNonIdPath.width).toBe(200);
		expect(imageAssetNonIdPath.height).toBe(120);

		const audioAsset = activeClient.createDummyAudioAsset({
			id: "dummy-audio-asset-id",
			path: "dummy-audio-asset-path",
			duration: 1290,
			systemId: "sound"
		});
		expect(audioAsset.id).toBe("dummy-audio-asset-id");
		expect(audioAsset.path).toBe("dummy-audio-asset-path");
		expect(audioAsset.duration).toBe(1290);
		expect(audioAsset.loop).toBe(false);
		expect(audioAsset.hint).toBeUndefined();

		const audioAssetNonIdPath = activeClient.createDummyAudioAsset({
			duration: 10491,
			systemId: "music",
			loop: true,
			hint: {
				streaming: true
			}
		});
		expect(audioAssetNonIdPath.id).toBeDefined();
		expect(audioAssetNonIdPath.path).toBeDefined();
		expect(audioAssetNonIdPath.duration).toBe(10491);
		expect(audioAssetNonIdPath.loop).toBe(true);
		expect(audioAssetNonIdPath.hint).toEqual({ streaming: true });
	});

	it("helloworld", async () => {
		const context = new GameContext<3>({ gameJsonPath });
		const activeClient = await context.getGameClient({ gameArgs: "active" });

		expect(activeClient.type).toBe("active");

		const game = activeClient.game!;
		expect(game).toBeInstanceOf(activeClient.g.Game);
		expect(game.width).toBe(800);
		expect(game.height).toBe(450);
		expect(game.fps).toBe(60);

		// advance to the entry scene
		await activeClient.advanceUntil(() => activeClient.game.scene()!.name === "entry-scene");

		const activeClientScene = activeClient.game.scene()!;
		expect(activeClientScene).toBeInstanceOf(activeClient.g.Scene);
		expect(activeClientScene).toBeDefined();
		expect(Object.keys(activeClientScene.assets).length).toBe(4); // player, shot, se, dummy_text
		expect(activeClientScene.children.length).toBe(1);

		const passiveClient = await context.createPassiveGameClient({ gameArgs: "passive" });
		expect(passiveClient.type).toBe("passive");

		// advance to the entry scene
		await passiveClient.advanceUntil(() => passiveClient.game.scene()!.name === "entry-scene");

		const passiveClientScene = passiveClient.game.scene()!;
		// same as the active client
		expect(passiveClientScene).toBeDefined();
		expect(Object.keys(passiveClientScene.assets).length).toBe(4);
		expect(passiveClientScene.children.length).toBe(1);

		// generate a sprite (shot) if clicked on the game canvas
		activeClient.sendPointDown(Math.ceil(Math.random() * game.width), Math.ceil(Math.random() * game.height), 0);
		context.step();
		expect(activeClientScene.children.length).toBe(2);

		activeClient.sendPointDown(Math.ceil(Math.random() * game.width), Math.ceil(Math.random() * game.height), 0);
		context.step();
		expect(activeClientScene.children.length).toBe(3);

		// enough time passed, must be removed all shot sprites
		await context.advance(3000);
		expect(activeClientScene.children.length).toBe(1);

		await context.destroy();
	});

	it("send message event", async () => {
		const context = new GameContext<3>({ gameJsonPath });
		const activeClient = await context.getGameClient();
		const passiveClient = await context.createPassiveGameClient();

		await activeClient.advanceUntil(() => activeClient.game.scene()!.name === "entry-scene");
		await passiveClient.advanceUntil(() => passiveClient.game.scene()!.name === "entry-scene");

		activeClient.sendMessage({ value: "foo" }, ":akashic", 0b00010);
		await activeClient.advanceUntil(() => 1 <= activeClient.game!.vars.messages?.length);

		const activeMessage = activeClient.game!.vars.messages[0];
		expect(activeMessage.data).toEqual({ value: "foo" });
		expect(activeMessage.eventFlags).toBe(0b00010);
		expect(activeMessage.local).toBe(false);
		expect(activeMessage.player).toEqual({ id: ":akashic" });

		await passiveClient.advanceUntil(() => 1 <= passiveClient.game!.vars.messages?.length);
		const passiveMessage = passiveClient.game!.vars.messages[0];
		expect(passiveMessage.data).toEqual({ value: "foo" });
		expect(passiveMessage.eventFlags).toBe(0b00010);
		expect(passiveMessage.local).toBe(false);
		expect(passiveMessage.player).toEqual({ id: ":akashic" });

		await context.destroy();
	});

	it("send join/leave event", async () => {
		const context = new GameContext<3>({ gameJsonPath });
		const activeClient = await context.getGameClient();
		const passiveClient = await context.createPassiveGameClient();

		await activeClient.advanceUntil(() => activeClient.game.scene()!.name === "entry-scene");
		await passiveClient.advanceUntil(() => passiveClient.game.scene()!.name === "entry-scene");

		// Join
		{
			// active 1
			activeClient.sendJoinEvent(":akashic", "system-user");
			await activeClient.advanceUntil(() => 1 <= activeClient.game!.vars.joins?.length);
			const activeJoins = activeClient.game!.vars.joins;
			expect(activeJoins[0].player).toEqual({
				id: ":akashic",
				name: "system-user"
			});
			expect(activeJoins[0].eventFlags).toBe(0);

			// passive 1
			await passiveClient.advanceUntil(() => 1 <= passiveClient.game!.vars.joins?.length);
			const passiveJoins = passiveClient.game!.vars.joins;
			expect(passiveJoins[0].player).toEqual({
				id: ":akashic",
				name: "system-user"
			});
			expect(passiveJoins[0].eventFlags).toBe(0);

			// active 2
			activeClient.sendJoinEvent("another-user-id", "another-user-name", 0b00010);
			await activeClient.advanceUntil(() => 2 <= activeClient.game!.vars.joins?.length);
			expect(activeJoins[1].player).toEqual({
				id: "another-user-id",
				name: "another-user-name"
			});
			expect(activeJoins[1].eventFlags).toBe(0b00010);

			// passive 2
			await passiveClient.advanceUntil(() => 2 <= passiveClient.game!.vars.joins?.length);
			expect(passiveJoins[1].player).toEqual({
				id: "another-user-id",
				name: "another-user-name"
			});
			expect(passiveJoins[1].eventFlags).toBe(0b00010);
		}

		// Leave
		{
			// active 1
			activeClient.sendLeaveEvent(":akashic");
			await activeClient.advanceUntil(() => 1 <= activeClient.game!.vars.leaves?.length);
			const activeLeaves = activeClient.game!.vars.leaves;
			expect(activeLeaves[0].player).toEqual({
				id: ":akashic",
				name: "system-user"
			});
			expect(activeLeaves[0].eventFlags).toBe(0);

			// passive 1
			await passiveClient.advanceUntil(() => 1 <= passiveClient.game!.vars.leaves?.length);
			const passiveLeaves = passiveClient.game!.vars.leaves;
			expect(passiveLeaves[0].player).toEqual({
				id: ":akashic",
				name: "system-user"
			});
			expect(passiveLeaves[0].eventFlags).toBe(0);

			// active 2
			activeClient.sendLeaveEvent("another-user-id", 0b00001);
			await activeClient.advanceUntil(() => 2 <= activeClient.game!.vars.leaves?.length);
			expect(activeLeaves[1].player).toEqual({
				id: "another-user-id",
				name: "another-user-name"
			});
			expect(activeLeaves[1].eventFlags).toBe(0b00001);

			// passive 2
			await passiveClient.advanceUntil(() => 2 <= passiveClient.game!.vars.leaves?.length);
			expect(passiveLeaves[1].player).toEqual({
				id: "another-user-id",
				name: "another-user-name"
			});
			expect(passiveLeaves[1].eventFlags).toBe(0b00001);
		}

		await context.destroy();
	});

	it("verbose = false", async () => {
		const consoleLogSpy = jest.spyOn(console, "log");

		const context = new GameContext<3>({ gameJsonPath, verbose: false });
		await context.getGameClient();

		// 一切のログが出力されていないことを確認
		expect(consoleLogSpy).not.toBeCalled();

		jest.clearAllMocks();
	});

	it("verbose = true", async () => {
		const consoleLogSpy = jest.spyOn(console, "log");

		const context = new GameContext<3>({ gameJsonPath, verbose: true });
		await context.getGameClient();

		expect(consoleLogSpy).toBeCalled();

		jest.clearAllMocks();
	});
});
