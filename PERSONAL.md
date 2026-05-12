# 个人分支使用说明

## 分支说明

- `main` — 跟随 upstream 原仓库，保持干净，不做个人修改
- `personal` — 个人定制分支，包含多租户 Docker 配置

## 同步原仓库更新

```bash
# 1. 切到 main，拉取原仓库最新代码
git checkout main
git fetch upstream
git merge upstream/main
git push origin main

# 2. 切回个人分支，rebase 到最新 main
git checkout personal
git rebase main

# 3. 推送（rebase 后需要 force push）
git push origin personal --force-with-lease
```

## 注意事项

- **不要在 main 分支上做任何改动**，否则后续 merge upstream 会产生冲突
- **rebase 如果有冲突**，逐个文件解决后执行 `git rebase --continue`，放弃则执行 `git rebase --abort`
- `.env.momo` / `.env.joker` 包含个人配置，不会提交到原仓库，注意备份
- 日常使用 Docker 时始终在 `personal` 分支上操作

## 启动多租户容器

```bash
# momo（端口 6060）
docker compose --project-name momo --env-file .env.momo up -d --build

# joker（端口 6061）
docker compose --project-name joker --env-file .env.joker up -d --build
```

## 停止容器

```bash
docker compose --project-name momo --env-file .env.momo down
docker compose --project-name joker --env-file .env.joker down
```

## 查看日志

```bash
docker logs hermes-webui-momo --tail 50
docker logs hermes-webui-joker --tail 50
```
