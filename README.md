# TIER STUDIO

スマートフォンとPCで使える、ログイン不要のTierランキング作成アプリ。React / TypeScript / Vite、dnd-kit、IndexedDB、Cloudflare Pages Functionsで構成しています。

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
2. Cloudflareの **Workers & Pages → Create → Pages → Connect to Git** から`sutunu/ranking`を選びます。公開準備用ブランチ`codex/tier-studio`をProduction branchに指定します（既定ブランチへ取り込んだ場合はそのブランチを指定）。
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

本番ビルド、モデル・APIの10件の自動テスト、Chromiumでの基本操作、390px幅の表示、タッチイベントによる長押しランク間移動と同ランク内の並び替え、実検索画像の追加とPNG出力を検証しています。iPhone Safari / Chrome実機の検証は未実施です。IndexedDBの容量は端末に依存し、保存失敗時は画面に表示します。プライベートブラウズ・ブラウザデータ削除には永続保存できません。大切な内容はJSONでバックアップしてください。保存画像は元画像を最大640pxに縮小したもので、元データ以上の画質にはなりません。

通信許可後、Wikimedia Commonsの実検索・画像取得、日本語「進撃の巨人」のKitsu検索（19件）・画像追加・PNG保存が成功しました。AniListは上流側403のため、この環境ではKitsuへの代替動作を検証しています。ネットワーク制限がある環境では`graphql.anilist.co`、`s4.anilist.co`、`kitsu.io`、`kitsu.app`、`media.kitsu.app`、`commons.wikimedia.org`、`upload.wikimedia.org`、`thumb.wikimedia.org`を許可してください。Cloudflare本番環境での検索はデプロイ後に確認してください。

ログイン・クラウド同期・共同編集・任意API横断検索は未実装です。Cloudflareへの実際の公開操作もまだ行っていません。
