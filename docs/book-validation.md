# 書籍表紙の実動検証

Chromiumスマホ幅で実検索し、各検索の表紙1点をSSへ直接追加、再読み込み、PNG出力まで確認しました。全候補を1点ずつ検証した件数ではありません。ソードアート・オンラインは小説分類の候補も別途検証しました。

|検索語|書籍表紙候補数|実画像・直接追加・保存復元・PNG|出典|
|---|---:|---|---|
|葬送のフリーレン|2|成功|Open Library|
|暗殺教室|15|成功|Open Library|
|ぼっち・ざ・ろっく！|1|成功|Open Library|
|ソードアート・オンライン|15|成功|Open Library|

## 実際に確認できた画像

- フリーレン: 海外版の漫画単行本表紙（Tome 1・Tome 2の候補）。Tierへ追加した1巻を目視でも確認しました。
- 暗殺教室: 漫画表紙の候補。画像配信の正規転送に対応後、取得・追加に成功。
- ぼっち・ざ・ろっく！: 単行本の表紙候補。
- ソードアート・オンライン: 漫画／書籍／小説分類の候補。小説分類の画像取得・追加・PNG出力を別途確認。

## 取得できていない画像・原因

- 添付されたフリーレンの日本語小説表紙そのもの、追加版の公式キービジュアル、Blu-ray/DVDジャケット、公式キャラクターイラストは今回取得未確認です。出版社サイトをスクレイピングして埋めてはいません。
- Google Booksは429（利用枠超過）。接続処理は実装済みですがライブの画像取得成功は未確認。任意の `GOOGLE_BOOKS_API_KEY` による自身の枠も使用可能です。
- NDLはISBN書誌を返しましたが、今回の対象に対するopenBDの表紙情報は空欄でした。一部検索ではタイムアウトしました。書誌があることと表紙が提供されることは別です。
- NDL書影APIは403だったため画像取得経路には組み込んでいません。
- AniList 403、Jikan 503。アニメの実ポスターは従来どおりKitsuから取得できます。

Open Library画像の一部は `covers.openlibrary.org → archive.org → ia数字.us.archive.org` に転送されます。初回の暗殺教室・SAO表紙追加は許可先外として失敗しました。表紙アーカイブに限定した正規転送の検証を追加し、再試験では4作品とも成功しました。任意のArchiveファイルやアクセス制限の回避は許可していません。

書籍タイトル・件名から漫画／小説と分かるものだけを分類し、不明なものは「書籍表紙」と表示します。取得元が公式性・自由転載許諾を保証するとは扱わず、未確認状態を保存しています。iPhone Safari実機・公開サイトは未確認です。

## 候補出典
- 葬送のフリーレン: Frieren Tome 1 — https://openlibrary.org/works/OL45824345W
- 葬送のフリーレン: Frieren - Tome 02 — https://openlibrary.org/works/OL45824683W
- 暗殺教室: Assassination classroom — https://openlibrary.org/works/OL20032987W
- 暗殺教室: Assassination Classroom, Vol. 1 — https://openlibrary.org/works/OL19622660W
- ぼっち・ざ・ろっく！: Bocchi the Rock!, Vol. 1 — https://openlibrary.org/works/OL35753085W
- ソードアート・オンライン: Sword art online — https://openlibrary.org/works/OL19711486W
- ソードアート・オンライン: Sword Art Online: Aincrad - manga (Sword Art Online Manga) — https://openlibrary.org/works/OL19086990W
- 小説追加検証: Sword art online（小説表紙）、画像取得=True、PNG=True
