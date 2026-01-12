予定調整くん（スケジュール調整アプリ）

URL: https://one1kazu13-schedule-arranger.onrender.com
Repo: https://github.com/11kazu13/schedule-arranger.git

GitHub OAuth認証を用いた予定調整サービス。
予定の作成・編集・削除、候補日程の作成、候補ごとの出欠登録（非同期更新）、コメント更新まで実装。
Prisma を用いた永続化に加え、バリデーション（Zod）や XSS / CSRF 等の基本的なセキュリティも考慮して設計・実装。