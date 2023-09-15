# CHANGELOG

## unreleased changes
* `GameClient#sendJoinEvent()` を追加
* `GameClient#sendLeaveEvent()` を追加
* `GameClient#sendMessageEvent()` に引数 `eventFlags: number` を追加

## 4.1.0
* headless-driver@2.10.0 に追従

## 4.0.0
* node-canvas を devDependencies へ変更
  * `GameContext#getGameClient()` で `renderingMode: "canvas"` に指定していた場合、別途 node-canvas のインストールが必要になります。

## 3.1.0
* node-canvas を optionalDependencies へ移動

## 3.0.1
* headless-driver@2.1.1 に追従

## 3.0.0
* headless-driver@2.0.0 に追従

## 2.2.0
* headless-driver@1.11.0 に追従

## 2.1.0
* `GameClient#createDummyImageAsset()`, `GameClient#createDummyAudioAsset()` を追加

## 2.0.0
* headless-driver@1.7.0 に追従
* `GameClientStartParameterObject#renderingMode` を追加
* `GameClient#getPrimarySurfaceCanvas()` を追加
* `GameClient#g` を追加
* `GameClient`, `GameClientParameterObject` の generics の型を変更

## 1.1.1
* `GameContextParameterObject#gameJsonPath` を省略した場合に空のゲームコンテンツを実行できるように

## 1.1.0
* `GameClient#advanceUntil()` を追加

## 1.0.1
* `GameContextParameterObject#verbose` を追加

## 1.0.0
* 初期リリース
