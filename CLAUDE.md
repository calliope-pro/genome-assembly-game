# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**ゲノムアセンブリチャレンジ**は、バイオインフォマティクスの核心技術「ゲノムアセンブリ」を体験できる教育ゲームです。DNA断片（reads）をドラッグ&ドロップで組み合わせて、元の完全なDNA配列を復元します。

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
- **ライセンス**: BSD 3-Clause License

### プロジェクト構造
```
├── src/
│   ├── App.jsx          - メインのゲームコンポーネント (GenomeAssemblyGame)
│   └── main.jsx         - Reactアプリのエントリーポイント
├── index.html           - HTMLテンプレート（SEO最適化済み）
├── vite.config.js       - Vite設定 (静的アセット配置用)
├── package.json         - プロジェクト設定（BSD-3-Clause ライセンス）
├── LICENSE              - BSD 3-Clause ライセンス全文
└── README.md            - プロジェクト説明とゲーム仕様
```

### アプリケーション設計

#### GenomeAssemblyGameコンポーネント
単一の大きなReactコンポーネントで、ゲノムアセンブリゲーム全体を管理:

**状態管理**:
- `level` - ゲームレベル (1-4)
- `seed` - 再現性のためのシード値
- `targetSequence` - 復元すべき目標DNA配列
- `reads` - DNA断片データ
- `selectedReads` - 選択済みDNA断片の配列順
- `assembledSequence` - アセンブリ結果
- `gameComplete` - ゲーム完了状態
- `score` - 累計スコア
- `readMemos` - メモ機能 (レベル2以降)
- `showOverlapHints` - オーバーラップヒント表示状態

**主要アルゴリズム**:
- `generateRealisticDNA()` - 生物学的に現実的なDNA配列生成
- `generateReadsFromReference()` - 参照配列からDNA断片生成 (オーバーラップ保証)
- `reverseComplement()` - リバースコンプリメント変換
- `findBestOverlap()` - 最適オーバーラップ検出
- `assembleSequenceFromReads()` - DNA断片のアセンブリ実行
- `checkSuccess()` - 成功判定 (レベル別基準)
- `calculateSimilarity()` - 配列類似度計算

**レベル仕様**:
- **レベル1 (基礎編)**: 50bp、6reads、12bp平均、エラーなし、正鎖のみ、100%一致必要 (50点)
- **レベル2 (応用編)**: 80bp、6reads、18bp平均、エラー1個、逆鎖1個、95%一致で成功 (200点)
- **レベル3 (上級編)**: 200bp、10reads、30bp平均、エラー2個、逆鎖3個、95%一致で成功 (1,000点)
- **レベル4 (実践編)**: 1,650bp、20reads、100bp平均、エラー5個、逆鎖5個、95%一致で成功 (10,000点)

### UI機能
- **ドラッグ&ドロップ**: DNA断片の順序変更
- **メモ機能**: read別の注釈 (レベル2以降)
- **オーバーラップヒント**: overlapWithPrev/Next表示（スコア半減）
- **シード機能**: 問題の再現性確保
- **カラーコード**: A=赤、T=青、G=緑、C=紫
- **視覚的フィードバック**: エラーread(⚠️)、逆鎖read(↺)
- **フッター**: 著作権表示、GitHubリンク、ライセンス情報

### SEO最適化
- **メタタグ**: title、description、keywords、author、robots
- **OGP/Twitter Card**: SNSシェア用メタデータ
- **構造化データ**: Schema.org WebApplication マークアップ
- **Google Search Console**: サイト検証タグ
- **正規URL**: canonical link設定

### ゲーム教育目標
- NGSシーケンシングとアセンブリの理解
- オーバーラップ検出アルゴリズムの体験
- リバースコンプリメントの概念学習
- シーケンシングエラー処理の実践
- 実際のNGSデータ規模での挑戦（レベル4）

## ライセンス
このプロジェクトは GNU Affero General Public License Version 3 (AGPL v3) の下で公開されています：
- 著作権: © 2025-present https://github.com/calliope-pro
- 利用、改変、配布は自由ですが、改変版を配布・ネットワーク経由で提供する場合は同じAGPL v3のもとでソースコードを公開する義務があります
- 著作権表示（クレジット）の保持が必要です
- 作者名の無断使用は禁止されています（パブリシティ権等に基づく制限）
