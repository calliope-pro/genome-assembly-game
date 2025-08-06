# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発コマンド

### 基本コマンド
- `npm install` - 依存関係をインストール
- `npm run dev` - 開発サーバーを起動 (Vite)
- `npm run build` - 本番用ビルドを作成
- `npm run lint` - ESLintでコードを検査
- `npm run preview` - ビルド後のプレビューを表示

### 開発フロー
- 開発時は`npm run dev`でライブサーバーを起動
- コード変更時は`npm run lint`でスタイルチェック
- デプロイ前は`npm run build`で本番ビルドを作成

## アーキテクチャ

### 技術スタック
- **フロントエンド**: React 18 + Vite
- **スタイル**: Tailwind CSS
- **アイコン**: Lucide React
- **言語**: JavaScript (ES6+)

### プロジェクト構造
```
src/
├── App.jsx          - メインのゲームコンポーネント (GenomeAssemblyGame)
├── main.jsx         - Reactアプリのエントリーポイント
index.html           - HTMLテンプレート
vite.config.js       - Vite設定 (静的アセット配置用)
```

### アプリケーション設計

#### GenomeAssemblyGameコンポーネント
単一の大きなReactコンポーネントで、ゲノムアセンブリゲーム全体を管理:

**状態管理**:
- `level` - ゲームレベル (1-3)
- `targetSequence` - 復元すべき目標DNA配列
- `reads` - DNA断片データ
- `selectedReads` - 選択済みDNA断片の配列順
- `assembledSequence` - アセンブリ結果
- `gameComplete` - ゲーム完了状態
- `readMemos` - メモ機能 (レベル2以降)

**主要アルゴリズム**:
- `generateRealisticDNA()` - 生物学的に現実的なDNA配列生成
- `generateReads()` - DNA断片生成 (オーバーラップ保証)
- `reverseComplement()` - リバースコンプリメント変換
- `findBestOverlap()` - 最適オーバーラップ検出
- `assembleSequence()` - DNA断片のアセンブリ実行
- `checkSuccess()` - 成功判定 (レベル別基準)

**レベル仕様**:
- **レベル1**: 4個のread、エラーなし、正鎖のみ、完全一致が必要
- **レベル2**: 6個のread、エラー1個、逆鎖1個、95%一致で成功
- **レベル3**: 6個のread、長い配列(120bp)、エラー1個、逆鎖1個

### UI機能
- **ドラッグ&ドロップ**: DNA断片の順序変更
- **メモ機能**: read別の注釈 (レベル2以降)
- **カラーコード**: A=赤、T=青、G=緑、C=紫
- **視覚的フィードバック**: エラーread(⚠️)、逆鎖read(↺)

### ゲーム教育目標
- NGSシーケンシングとアセンブリの理解
- オーバーラップ検出アルゴリズムの体験
- リバースコンプリメントの概念学習
- シーケンシングエラー処理の実践