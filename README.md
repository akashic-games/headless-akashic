<p align="center">
<img src="https://raw.githubusercontent.com/akashic-games/headless-akashic/main/img/akashic.png" />
</p>

# headless-akashic

Akashic コンテンツをヘッドレスで実行するためのモジュールです。
主にテストでの利用を想定しています。

## installation

npm 経由でインストールできます。

```sh
npm install @akashic/headless-akashic -D
```

## usage

任意のテストフレームワーク内で `@akashic/headless-akashic` を require します。

Node.js 上でのサンプルコードは以下になります。

```javascript
import * as assert from "node:assert";
import * as path from "node:path";
import { GameContext } from "@akashic/headless-akashic";

(async () => {
  const context = new GameContext({
    gameJsonPath: path.join(__dirname, "..", "helloworld", "game.json") // テストする game.json のパス
  });
  const client = await context.getGameClient();

  const game = client.game;
  assert.strictEqual(game.width, 800);
  assert.strictEqual(game.height, 450);
  assert.strictEqual(game.fps, 60);

  await client.advanceUntil(() => {
    return game.scene().name === "..." // 名前が "..." のシーンをロードするまで進める
  });

  const entity = scene.children[0];
  assert(entity instanceof client.g.Sprite); // entity が g.Sprite であることを確認

  // ダミーの ImageAsset から g.Sprite を生成
  const dummySprite = new client.g.Sprite({
    scene: game.scene(),
    src: client.createDummyImageAsset({
      id: "dummy-image-asset-id",
      path: "dummy-image-asset-path",
      width: 150,
      height: 107
    }),
    width: 150,
    height: 107
  });

  // ...

  await context.destroy(); // GameContext の破棄
})();

```

## note

### コンテンツの描画内容の取得

akashic-engine@3.0.0 以降に対応したコンテンツであれば `GameClient#getPrimarySurfaceCanvas()` を利用して描画内容を取得できます。
headless-akashic@4.7.0 時点で以下のモジュールによる描画出力をサポートしています。

* [node-canvas][node-canvas]
* [@napi-rs/canvas][napi-canvas]

`renderingMode: "canvas"` の場合は下記コマンドで node-canvas をインストールしてください。

```sh
npm i -D canvas
```

`renderingMode: "@napi-rs/canvas"` の場合は下記コマンドで @napi-rs/canvas をインストールしてください。

```sh
npm i -D @napi-rs/canvas
```

以下はコンテンツの描画内容を png として保存する例です。

```javascript
import { writeFileSync } from "node:fs";

// ...

const client = await context.getGameClient({ renderingMode: "canvas" }); // renderingMode を指定
const canvas = client.getPrimarySurfaceCanvas();
writeFileSync("output.png", canvas.toBuffer("image/png")); // "output.png" に描画内容を書き出し
```

### 空のゲームコンテンツの仕様

`GameContext` の生成時に `gameJsonPath` を省略した場合、空のゲームコンテンツを自動で実行します。
このゲームコンテンツは以下の設定値で初期化されます。

| 設定 | 値 |
| --- | --- |
| environment.sandbox-runtime | `"3"` |
| width | `1280` |
| height | `720` |
| fps | `60` |

これらの値は headless-akashic のバージョンにより変動する可能性があります。
したがって、これらの値をテスト等で決め打ちすることは避けてください。

### TypeScript での型の解決

headless-akashic はコンテンツのバージョンを動的に読み込むため、そのままではバージョンに応じた型定義を参照することができません。
バージョンに応じた型を静的に確定したい場合、以下のように `GameContext` の生成時に generics でバージョンを指定してください。

```typescript
// ...

const context = new GameContext<3>({ gameJsonPath }); // generics による型の指定 (v3 の場合)
const client = await context.getGameClient();

const game = client.game!;
await client.advanceUntil(() => client.game.scene().name === "entry-scene");

const scene = activeClient.game.scene()!;
scene.asset.getImage(...) // akashic-engine@3 の型定義を参照
```

または、以下のように as 演算子でダウンキャストすることができます。

```typescript
import type { RunnerV3Game } from "@akashic/headless-akashic";
import type { Canvas } from "@napi-rs/canvas";

// ...

const context = new GameContext({ gameJsonPath });
const client = await context.getGameClient();
const game = client.game as RunnerV3Game;

// ...

const canvas = client.getPrimarySurfaceCanvas() as Canvas;

// ...

```

各バージョンと型名の関係は以下のようになります。

| akashic-engine のバージョン | `g` の型 | `g.game` の型 |
| --- | --- | --- |
| 1 | `RunnerV1_g` | `RunnerV1Game` |
| 2 | `RunnerV2_g` | `RunnerV2Game` |
| 3 | `RunnerV3_g` | `RunnerV3Game` |

## limitation

### 日本語の文字列の描画

バージョン `0.1.66` 時点の `@napi-rs/canvas` では、初期状態のままでは `g.DynamicFont` で日本語などの非 ASCII 文字を描画できません。
`g.DynamicFont` で日本語を描画する場合、[`@napi-rs/canvas` の README][napi-canvas] を参考に日本語対応のフォントファイルを別途読み込んでください

### 音声の再生に関して

`@akashic/headless-akashic@2.0.0` において、headless-akashic 上で実行されているコンテンツの音声再生をサポートしていません。

### ゲームコンテンツ内でのコンストラクタの等価性

ゲームコンテンツ内のあるエンティティ (`g.Sprite` など) とのコンストラクタの等価性を確認したい場合、 `GameClient#g` のプロパティを参照してください。

```javascript
import * as g from "@akashic/akashic-engine";
import { GameContext } from "@akashic/headless-akashic";

// ...

const client = await context.getGameClient();

// ...

const entity = scene.children[0];
assert(entity instanceof client.g.Sprite); // entity が g.Sprite であることを確認
```

### g および g.game の解決

headless-akashic は、 require しただけではゲームコンテンツの実行環境において存在すべきグローバル変数 `g` 及び `g.game` を解決しません。
(注: `GameContext#start()` により実行されるゲームコンテンツのスクリプトアセット内では `g` や `g.game` は自動的に解決されます)

`g` に関するモジュール (`g.E` を継承したクラスなど) を単体テストしたいなどのケースでは、利用者自身で `globalThis` への `g` の代入が必要となります。

以下は Node.js 上でのサンプルです。

```javascript
const g = require("@akashic/akashic-engine");
globalThis.g = g;

// 以降 `g` の名前空間が参照可能になります

...

const client = await context.getGameClient();
const game = client.game;

globalThis.g.game = game;

// 以降 `g.game` が参照可能になります

const player = new Player({
  scene: g.game.scene(),
  width: 32,
  height: 32,
  ...
});

...

```

[node-canvas]: https://github.com/Automattic/node-canvas
[napi-canvas]: https://github.com/Brooooooklyn/canvas
