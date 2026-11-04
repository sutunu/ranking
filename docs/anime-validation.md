# アニメ検索検証結果

実API検索とChromiumスマホ幅の隔離ブラウザで実行。画像追加は実際の検索応答と画像プロキシを用い、各作品をSSへ直接追加して再読み込みしました。iPhone Safari実機・公開サイトは未確認です。

|正式名|検索|画像取得|直接追加|保存復元|別名|別名の先頭候補|
|---|---|---|---|---|---|---|
|葬送のフリーレン|成功|成功|成功|成功|フリーレン|葬送のフリーレン|
|デッドデッドデーモンズデデデデデストラクション|成功|成功|成功|成功|デデデデ|デッドデッドデーモンズデデデデデストラクション|
|暗殺教室|成功|成功|成功|成功|Assassination Classroom|暗殺教室|
|進撃の巨人|成功|成功|成功|成功|進撃|進撃の巨人|
|鋼の錬金術師|成功|成功|成功|成功|ハガレン|鋼の錬金術師|
|STEINS;GATE|成功|成功|成功|成功|Steins Gate|STEINS;GATE|
|ヴァイオレット・エヴァーガーデン|成功|成功|成功|成功|Violet Evergarden|ヴァイオレット・エヴァーガーデン|
|新世紀エヴァンゲリオン|成功|成功|成功|成功|Neon Genesis Evangelion|新世紀エヴァンゲリオン|
|HUNTER×HUNTER|成功|成功|成功|成功|Hunter x Hunter|HUNTER×HUNTER ハンターハンター|
|魔法少女まどか☆マギカ|成功|成功|成功|成功|まどかマギカ|劇場版 魔法少女まどか☆マギカ 叛逆の物語|

全10作品の今回取得した画像はKitsu登録ポスターです。出典は各候補のKitsu作品ページへリンクしています。公式性の独立検証と転載許諾の確認はできていません。API規約参照先は https://kitsu.docs.apiary.io/ です。取得成功は商用転載許諾の取得を意味しません。

AniListはこの環境から403、Jikanは503でした。両APIのライブ成功は未確認です。Kitsuが実検索をカバーしました。API追加による成功率向上を数値の網羅率として保証するものではありません。

初回に「ハガレン」が別作品、エヴァンゲリオンが劇場版優先になる問題を検出し、正式名のリダイレクト解決・日英別名の関連度を修正して再検証しました。「まどかマギカ」の別名では現在も関連映画が先頭です。TV版の正式名検索は成功しています。全略称が意図した版を必ず先頭にすることは未達です。

## 出典
- 葬送のフリーレン: https://kitsu.app/anime/sousou-no-frieren
- デッドデッドデーモンズデデデデデストラクション: https://kitsu.app/anime/dead-dead-demons-dededede-destruction
- 暗殺教室: https://kitsu.app/anime/ansatsu-kyoushitsu-tv
- 進撃の巨人: https://kitsu.app/anime/attack-on-titan
- 鋼の錬金術師: https://kitsu.app/anime/fullmetal-alchemist
- STEINS;GATE: https://kitsu.app/anime/steins-gate
- ヴァイオレット・エヴァーガーデン: https://kitsu.app/anime/violet-evergarden
- 新世紀エヴァンゲリオン: https://kitsu.app/anime/neon-genesis-evangelion
- HUNTER×HUNTER: https://kitsu.app/anime/hunter-x-hunter-2011
- 魔法少女まどか☆マギカ: https://kitsu.app/anime/mahou-shoujo-madoka-magica
