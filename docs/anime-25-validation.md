# 25作品の検索・画像取得検証

指定20作品と旧年代5作品を対象に実APIと隔離Chromiumスマホ幅で実施。初回検証後、重点5作品は軽量別名解決版で、コードギアス・まどかは順位修正版で再確認した結果を統合しています。

- 作品検索（タイトル・放送年・出典照合）: 25/25 = 100%
- 画像取得・SS直接追加: 25/25 = 100%
- 再読み込み後の画像保持: 25/25 = 100%
- 100作品以上の検証は未実施。この25作品以外を含む全作品の成功率ではありません。
- 正しい作品の判定は登録元の作品名・年・作品ページとの照合です。画像自体の公式性・転載許諾は未確認。ライブ取得元は全件Kitsu、AniListは403、Jikanは503でした。

|検索語|先頭作品|年|画像・追加・復元|別名検索の先頭|
|---|---|---|---|---|
|暗殺教室|暗殺教室|2015|成功|暗殺教室|
|宝石の国|宝石の国|2017|成功|宝石の国|
|GANTZ|ガンツ|2004|成功|ガンツ|
|葬送のフリーレン|葬送のフリーレン|2023|成功|葬送のフリーレン|
|デッドデッドデーモンズデデデデデストラクション|デッドデッドデーモンズデデデデデストラクション|2024|成功|デッドデッドデーモンズデデデデデストラクション|
|進撃の巨人|進撃の巨人|2013|成功|進撃の巨人|
|新世紀エヴァンゲリオン|新世紀エヴァンゲリオン|1995|成功|新世紀エヴァンゲリオン|
|コードギアス|コードギアス 反逆のルルーシュ|2006|成功|コードギアス 反逆のルルーシュ|
|STEINS;GATE|STEINS;GATE|2011|成功|STEINS;GATE|
|鋼の錬金術師|鋼の錬金術師|2003|成功|鋼の錬金術師|
|HUNTER×HUNTER|HUNTER×HUNTER ハンターハンター|2011|成功|HUNTER×HUNTER ハンターハンター|
|銀魂|銀魂|2006|成功|銀魂|
|CLANNAD|CLANNAD|2007|成功|CLANNAD|
|四月は君の嘘|四月は君の嘘|2014|成功|四月は君の嘘|
|東京喰種|東京喰種-トーキョーグール-|2014|成功|東京喰種-トーキョーグール-|
|ノーゲーム・ノーライフ|ノーゲーム・ノーライフ|2014|成功|ノーゲーム・ノーライフ|
|オーバーロード|オーバーロード|2015|成功|オーバーロード|
|魔法少女まどか☆マギカ|魔法少女まどか★マギカ|2011|成功|魔法少女まどか★マギカ|
|ヴァイオレット・エヴァーガーデン|ヴァイオレット・エヴァーガーデン|2018|成功|ヴァイオレット・エヴァーガーデン|
|ぼっち・ざ・ろっく！|ぼっち・ざ・ろっく！|2022|成功|ぼっち・ざ・ろっく！|
|鉄腕アトム|鉄腕アトム|1963|成功|鉄腕アトム|
|宇宙戦艦ヤマト|宇宙戦艦ヤマト|1974|成功|宇宙戦艦ヤマト|
|機動戦士ガンダム|機動戦士ガンダム|1979|成功|機動戦士ガンダム|
|天空の城ラピュタ|天空の城ラピュタ|1986|成功|天空の城ラピュタ|
|攻殻機動隊|GHOST IN THE SHELL（攻殻機動隊）|1995|成功|GHOST IN THE SHELL（攻殻機動隊）|

## 原因と再検証

5作品の個別登録は行っていません。別名解決が画像メタデータAPIの取得に依存する構造を分離し、直接リダイレクトと言語間リンクを並列取得、取得済み別名を短期作品索引へ保存するようにしました。異なる表記で再利用できる範囲を広げています。

「コードギアス」は初回2024年の続編が先頭でした。直接一致の関連度を優先し、同程度なら古い原シリーズを先にする修正後、2006年版の画像取得・追加・復元まで再試験しました。別版は削除・統合せず、作品名と年で区別します。

失敗した正式名の作品は今回の最終25件ではありません。ただし一部別名は別シーズンや関連作品が先頭です。別名検索は件数だけで一律成功にせず、表に実際の先頭候補を示しています。iPhone Safari実機・公開URLでの検証、画像内容や公式性の独立した権利者確認は未実施です。

## 出典・条件

全件Kitsuの作品ページ・API規約を候補に保持。https://kitsu.docs.apiary.io/ 。無料API・非営利運営は画像の自由転載許諾を意味しません。公式サイトの無断取得は行っていません。各画像の使用可否は権利者とAPI規約で確認してください。

- 暗殺教室: https://kitsu.app/anime/ansatsu-kyoushitsu-tv
- 宝石の国: https://kitsu.app/anime/houseki-no-kuni-tv
- GANTZ: https://kitsu.app/anime/gantz
- 葬送のフリーレン: https://kitsu.app/anime/sousou-no-frieren
- デッドデッドデーモンズデデデデデストラクション: https://kitsu.app/anime/dead-dead-demons-dededede-destruction
- 進撃の巨人: https://kitsu.app/anime/attack-on-titan
- 新世紀エヴァンゲリオン: https://kitsu.app/anime/neon-genesis-evangelion
- コードギアス: https://kitsu.app/anime/code-geass-lelouch-of-the-rebellion
- STEINS;GATE: https://kitsu.app/anime/steins-gate
- 鋼の錬金術師: https://kitsu.app/anime/fullmetal-alchemist
- HUNTER×HUNTER: https://kitsu.app/anime/hunter-x-hunter-2011
- 銀魂: https://kitsu.app/anime/gintama
- CLANNAD: https://kitsu.app/anime/clannad
- 四月は君の嘘: https://kitsu.app/anime/shigatsu-wa-kimi-no-uso
- 東京喰種: https://kitsu.app/anime/tokyo-ghoul
- ノーゲーム・ノーライフ: https://kitsu.app/anime/no-game-no-life
- オーバーロード: https://kitsu.app/anime/overlord
- 魔法少女まどか☆マギカ: https://kitsu.app/anime/mahou-shoujo-madoka-magica
- ヴァイオレット・エヴァーガーデン: https://kitsu.app/anime/violet-evergarden
- ぼっち・ざ・ろっく！: https://kitsu.app/anime/bocchi-the-rock
- 鉄腕アトム: https://kitsu.app/anime/astro-boy
- 宇宙戦艦ヤマト: https://kitsu.app/anime/uchuu-senkan-yamato
- 機動戦士ガンダム: https://kitsu.app/anime/mobile-suit-gundam-0079
- 天空の城ラピュタ: https://kitsu.app/anime/laputa-castle-in-the-sky
- 攻殻機動隊: https://kitsu.app/anime/ghost-in-the-shell
