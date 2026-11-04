# TIER STUDIO

スマートフォンとPCで使える、ログイン不要のTierランキング作成アプリ。React / TypeScript / Vite、dnd-kit、IndexedDB、Cloudflare Pages Functionsで構成しています。

## v2：検索・ジャンル管理の改善

- 日本語・英語Wikipediaの検索インデックス、言語間リンク、検索候補補正を使い、略称・部分名から正式名を解決。かな・全半角・英大小文字を正規化して関連度順に表示します。入力ミスへの対応は検索元の補正候補に依存し、任意の誤字を保証するものではありません。
- アニメ・漫画はAniList / Kitsu、一般ジャンルはWikipedia / Commons、食品はOpen Food Factsも組み合わせます。ジャンルは検索順位を優先するもので、対象を排他的に限定しません。検索欄で「一般検索に広げる」へ切替可能です。商品名の固定リストは使いません。
- 画像配信先の限定を維持し、許可済みホスト間のみ最大4回の転送を追跡。失敗時は検索元が提供する元画像等の代替URLを試行します。サムネイルも同じ画像取得経路で表示します。追加失敗は候補に表示し、別の候補を選べます。
- 任意ジャンルの作成・名前変更、作成時のジャンル選択、既存ランキングの移動、ジャンルとタイトルでの絞り込み。複製・削除・Undo/Redo等は維持します。
- 既存のIndexedDBキー `tier-studio-v1` を維持。旧データは初回移行前に `tier-studio-backup-v1` に原本を退避し、画像・ID・ランクを保持したまま `version: 2` とジャンル情報を追加します。ジャンル未設定は「その他」です。読み込み失敗時は自動保存を開始せず、元データのダウンロードを案内します。
- マイランキングの「すべてバックアップ」はジャンル一覧を含むJSONを出力します。旧JSON配列と新形式をどちらも復元可能です。

### APIの料金・利用条件

追加APIキーや有料サービスは使いません。Wikipedia / CommonsのAPIは無料ですが、画像の利用条件はファイルごとに異なります。作者・ライセンス名・ライセンスURL・出典ページ・加工情報を保持します。Kitsu / AniListの作品画像は権利者の著作物であり、API提供は画像の自由利用許諾を意味しません。

Open Food Factsは公開API（https://openfoodfacts.github.io/openfoodfacts-server/api/ ）。検索は10回/分の上限を前提に、結果の5分キャッシュ・候補件数制限・Workerインスタンス内で8回/分の食品検索制限を設けています。画像はCC BY-SA 3.0、データベースはODbLの条件に従い、画像クレジットと製品ページを保持します。配信許可ホストに `images.openfoodfacts.org` を追加しています。共通のキャッシュはWorkerインスタンス内に限られます。多数の利用者向けの集約レート制限は別途必要です。Cloudflare自体の利用枠・料金はアカウントのプランに依存します。

### 検証と残る制限

ビルド、サーバーを含むTypeScriptチェック、21件の自動テスト、Pages Functionsコンパイルを確認しています。Chromiumのスマホ幅・タッチイベントによる操作検証を行い、iPhone Safari実機は未確認です。利用者の実ブラウザ内データへはアクセスせず、既存画像を含む旧形式データを隔離ブラウザに投入して移行を検証します。

実検索で「フリーレン」「進撃」「鬼滅」「リゼロ」、商品画像で「じゃがりこ」「ハイチュウ」「ポッキー」「たけのこの里」「堅あげポテト」を確認しました。**「ピュレグミ」は商品そのものの画像を確認できていません**。関連画像が表示される場合があり、パッケージ写真の取り違えに注意してください。Open Food Factsは調査時503が断続的に発生しました。後続の検証でじゃがりこの味別商品の実検索に成功しましたが、安定稼働と全商品の取得は未確認です。全商品・全作品の画像や、全ての外部サービスの稼働を保証しません。特定商品の画像を偽装する登録や、メーカーサイトの無許可スクレイピングは行いません。

公開URL・Pagesプロジェクト設定は変更しません。既存のmain連携が有効ならGitHub反映後に同じサイトへ自動デプロイされます。公開サイトの実動確認はURLとデプロイ完了を確認してから行ってください。

## 開発

Node.js 24（この環境では24.22.1）、npmを使用します。

```sh
cd /workspace/ranking
npm ci
npm run build
npm test
npm run start:local
```

プロキシ対応のローカルサーバーがビルド済み静的ファイルと`functions/`と同じハンドラーを提供します。`HTTP_PROXY` / `HTTPS_PROXY`とCA設定を維持します。Cloudflareランタイムでのコンパイル確認には`npm run pages:dev`も使用できますが、このクラウド環境のWrangler内Workerは外部通信プロキシを継承しないため、実API検証には`start:local`を使います。`npm run dev`はUI単体の開発用であり、検索APIは提供しません。ソースを変更したら`npm run build`でPages用出力を更新してください。

ブラウザテスト:

```sh
npx playwright install chromium
npm run test:browser
# ジャンル移行・実商品画像の追加保存を検証（隔離ブラウザ）
npm run test:genres
# 既存Chromiumを使う場合:
BROWSER_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
```

実API・タッチ操作の検証は`npm run test:live`でも実行できます（外部APIへの通信が必要です）。

先にローカルサーバーを起動してください。`BASE_URL`でテスト対象を変更できます。テストは新しいブラウザコンテキストを使用し、利用者の保存データを消しません。検索の上流応答はテスト内で差し替えます。実APIの疎通テストとは別です。生成物は`artifacts/`に保存されます。

## 実装機能

- SS / S / A / B / C / D、ランク名・色・順番の変更、追加・削除。削除時の画像は未分類に戻ります。
- 画像の検索、端末からのアップロード、HTTPS画像URL入力。画像の追加・削除・名前変更・入れ替え、重複防止。
- dnd-kitによるマウス・長押しタッチドラッグ、同一ランク内の並び替え。画像をタップして移動先を選ぶ操作も可能。タッチは230ms長押しでドラッグ開始し、それまでは縦スクロールを優先します。
- ランキングタイトル、画像フィルター、未分類エリア、40操作のUndo / Redo、初期化。
- 複数ランキング、複製・削除・タイトル欄での名前変更。
- IndexedDBへの自動保存。端末・ブラウザごとの保存であり、別端末同期はありません。
- 画像を含むJSONの書き出しと復元。復元は既存データを上書きせず、新規ランキングとして取り込みます。
- 縦横比維持 / 統一サイズ表示切り替え。
- 全ランク・タイトル・出典を含む幅2800pxのPNG保存。ダーク / ホワイト背景。長いランクは折り返し、端を切りません。出力高さの上限は32000pxで、超える場合は分割を案内します。未分類と編集UIは含みません。
- PNG生成後の共有ボタンはWeb Share API対応端末で共有メニューを開き、非対応端末ではダウンロードします。

## 画像検索と権利

### AniList

`POST https://graphql.anilist.co`。アニメ作品名を日本語 / 英語で検索し、作品名・カバー画像・作品ページを取得します。成人向けフラグの作品を除外し、1回24件に制限します。APIキー不要。カバー画像の権利は各権利者に帰属し、検索結果には作品ページへのリンク、保存画像には出典を付けます。API利用と画像の再利用許諾は別です。公開・再配布前に利用条件を確認してください。

- API: https://docs.anilist.co/
- 利用条件: https://docs.anilist.co/guide/terms-of-use

### Kitsu（アニメ検索の代替）

AniListが失敗した場合は`https://kitsu.io/api/edge/anime`へ自動的に切り替えます。日本語タイトル、ポスター、作品ページを取得し、出典を保持します。成人向けフラグのある候補は除外します。APIキー不要。画像の権利は各権利者に帰属します。

- API: https://kitsu.docs.apiary.io/
- 作品情報: https://kitsu.app/

### Wikimedia Commons

`https://commons.wikimedia.org/w/api.php`のMediaWiki APIで幅広いジャンルを検索します。名称、サムネイル、作者、ライセンス名、出典ページを取得します。日本語検索に対応しますが、日本語のメタデータが少ない画像は英語で検索してください。ライセンス情報が取得できない候補は表示しません。作者・ライセンス・出典は画像と一緒に保存し、PNG下部にも記載します。出典ページで画像ごとの条件を確認してください。

- API: https://www.mediawiki.org/wiki/API:Main_page
- 再利用: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia

TMDB / RAWG、漫画専用・人物専用APIは未接続です。それらのジャンルはCommons検索、URL入力、アップロードで利用できます。すべての作品・人物について画像が見つかる保証はありません。

### CORSと画像保存

検索APIはPages Functionsから呼び出します。検索画像は`/api/image`で取得し、ブラウザで最大辺640pxのPNGに変換してIndexedDBへ保存します。PNG出力時は保存済みデータのみをCanvasへ描画するので、再取得や外部画像のCORSに依存しません。

画像プロキシはHTTPSの`upload.wikimedia.org`、`thumb.wikimedia.org`、`s4.anilist.co`、`media.kitsu.app`のみ許可し、リダイレクト、ポート指定、URL内認証を拒否します。画像MIME・15MB上限・タイムアウトも検査します。任意URLの公開プロキシにはしません。直接入力の他ドメイン画像は、そのサイトがブラウザCORS取得を許可する場合のみ対応します。失敗時はアップロードを案内します。SVGは受け付けません。GIFは静止画として追加されます。

画像は利用者が権利を確認して追加してください。出典やライセンスの保持だけで、すべての利用が許可されるわけではありません。

## Cloudflare Pagesへ公開

1. このリポジトリをGitHubへ反映します。
2. Cloudflareの **Workers & Pages → Create → Pages → Connect to Git** から`sutunu/ranking`を選びます。Production branchに`main`を指定します。フレームワークプリセットは`Vite`、ルートディレクトリは空欄（リポジトリ直下）にします。
3. ビルドコマンドを`npm run build`、出力ディレクトリを`dist`、ルートディレクトリをこのプロジェクトのルートに設定します。Nodeバージョンは24を指定します。
4. デプロイすると`functions/api/search.ts`と`functions/api/image.ts`も実行されます。単なる`dist`の静的アップロードではAPIが動かないので、Git連携またはWranglerを使います。
5. 検索・画像追加・PNG保存を公開URLで確認してください。

CLIを使う場合はCloudflare認証済みの端末で:

```sh
npm run build
npx wrangler pages deploy dist --project-name tier-studio
```

この実装にAPIキー・DB・ログイン設定は不要です。将来キーが必要なAPIを追加する際はPagesのシークレットへ保存し、ブラウザコードや`VITE_*`変数に入れないでください。

## 検証と制限

本番ビルド、モデル・API・保存移行の21件の自動テスト、Chromiumでの基本操作、390px幅の表示、タッチイベントによる長押しランク間移動と同ランク内の並び替え、実検索画像の追加とPNG出力を検証しています。iPhone Safari / Chrome実機の検証は未実施です。IndexedDBの容量は端末に依存し、保存失敗時は画面に表示します。プライベートブラウズ・ブラウザデータ削除には永続保存できません。大切な内容はJSONでバックアップしてください。保存画像は元画像を最大640pxに縮小したもので、元データ以上の画質にはなりません。

通信許可後、Wikimedia Commonsの実検索・画像取得、日本語「進撃の巨人」のKitsu検索（19件）・画像追加・PNG保存が成功しました。AniListは上流側403のため、この環境ではKitsuへの代替動作を検証しています。ネットワーク制限がある環境では`graphql.anilist.co`、`s4.anilist.co`、`kitsu.io`、`kitsu.app`、`media.kitsu.app`、`commons.wikimedia.org`、`upload.wikimedia.org`、`thumb.wikimedia.org`を許可してください。Cloudflare本番環境での検索はデプロイ後に確認してください。

ログイン・クラウド同期・共同編集・任意API横断検索は未実装です。Cloudflareへの実際の公開操作もまだ行っていません。
