# HARTLink Studio private COS download proxy

`download.modusignal.cn` is the only public download endpoint. The Worker signs short-lived COS V5 requests at the edge, while the source bucket remains private.

## Required Cloudflare secrets

Create a dedicated Tencent CAM programmatic user with read-only access to the OTA prefix. Store its credentials as encrypted Worker secrets; never put them in this repository or in Wrangler variables.

```bash
npx wrangler secret put COS_SECRET_ID --config workers/cos-download-proxy/wrangler.jsonc
npx wrangler secret put COS_SECRET_KEY --config workers/cos-download-proxy/wrangler.jsonc
npx wrangler deploy --config workers/cos-download-proxy/wrangler.jsonc
```

The read-only CAM policy should be limited to these actions and this resource:

```json
{
  "version": "2.0",
  "statement": [
    {
      "effect": "allow",
      "action": ["cos:GetObject", "cos:HeadObject"],
      "resource": [
        "qcs::cos:ap-hongkong:uid/1257631357:hartlinkstudio-ota-ap-1257631357/HARTLinkStudio/ota/*",
        "qcs::cos:ap-hongkong:uid/1257631357:hartlinkstudio-ota-ap-1257631357/HARTForgeStudio/ota/*"
      ]
    }
  ]
}
```

## Release configuration

Set the HARTLink-Studio repository variable `HARTLINK_OTA_BASE_URL` to:

```text
https://download.modusignal.cn/HARTLinkStudio/ota
https://download.modusignal.cn/HARTForgeStudio/ota
```

Keep each publishing workflow restricted to its product prefix. The Worker accepts only the explicit comma-separated `COS_PREFIXES` value from `wrangler.jsonc`, and its COS credential must stay read-only for those same two prefixes.

After deploying the Worker and publishing a manifest that points at the download domain, change the COS bucket ACL to private read/write. Direct COS URLs should then return `403`, while the Worker URL should continue returning `200` and `206` for range requests.

## 官网下载统计

统计名称为「官网下载开始次数」，从上线时开始累计，不能回补过去的准确下载量，也不代表安装人数或完整下载成功次数。

- 只处理官网下载链接携带的 `source=website&download_id=<UUID>`，普通直链和软件 OTA 不计入。
- 浏览器对同一文件在 30 分钟内复用一个匿名下载 ID，合并重复点击、重试和多线程 Range 请求。超过 30 分钟重新点击生成新 ID；已经开始的断点续传沿用原 URL，仍不会重复计数。
- 只有 Worker 返回带文件内容的 GET `200/206` 才写入；HEAD、失败响应、版本检查、校验文件、预取不计入。缓存命中经过同一计数路径。
- D1 主键和 SQL 触发器在一次原子写入中完成去重及日汇总。统计不依赖日志抽样。按北京时间分日、版本、系统、架构和安装包格式查看。
- 不保存 IP、浏览器指纹、Cookie 或跨文件的用户标识。数据库及查询权限留在 Cloudflare 后台，前端没有写库接口或密钥。D1 数据库 ID 是资源标识，不是访问凭证，可以随配置开源。
- 只有 `https://modusignal.cn` 页面生成统计链接；本地、离线包和正常运行的 fork 保留普通直链。Referer 存在且非官网时不计入。

准确性边界：这是按规则去重的下载开始记录。用户中途取消、下载管理器重新创建请求、清除本地存储、复制带相同 ID 的链接都会影响其与“实际完成下载人数”的关系。公开下载服务无法证明请求一定来自真人，Origin/Referer 也不是身份认证；不要把这个数字命名为“用户数”或“成功安装数”。

### 数据库与上线顺序

先创建专用 D1 `modusignal-download-stats`，执行 `migrations/0001_download_stats.sql`，再将配置中的 `DOWNLOAD_STATS` 绑定指向该库。先部署下载 Worker，确认普通文件和 Range 下载正常，再部署官网。不要改动 COS 密钥、现有域名或其他 Worker 的路由。

```bash
npx wrangler d1 migrations apply modusignal-download-stats --remote --config workers/cos-download-proxy/wrangler.jsonc
npx wrangler deploy --config workers/cos-download-proxy/wrangler.jsonc
```

如果使用控制台初始化而非 Wrangler migrations，先在库中执行迁移文件全部 SQL。初始迁移可重复执行，后续改用 Wrangler 时也不会清空已有数据。保留下载明细以保证旧下载 URL 永久去重，不单独清空明细或汇总表。

### 查看数量

Cloudflare → 存储和数据库 → D1 → `modusignal-download-stats` → 控制台。以下查询只在已登录的后台执行，没有公开统计接口。

```sql
-- 官网累计下载开始次数
SELECT COALESCE(SUM(downloads), 0) AS total FROM website_download_daily;

-- 最近 30 天，每日下载量（北京时间）
SELECT day, SUM(downloads) AS downloads FROM website_download_daily
WHERE day >= date('now', '+8 hours', '-29 days')
GROUP BY day ORDER BY day DESC;

-- 按版本、系统和安装包分组
SELECT product, version, os, architecture, package_type, SUM(downloads) AS downloads
FROM website_download_daily
GROUP BY product, version, os, architecture, package_type
ORDER BY version DESC, os, package_type;
```

写库在返回下载响应前完成；确认丢失时会安全重试一次。两次都失败仍提供文件，避免统计故障中断下载，同时记录 `download_count_failed` 结构化事件。出现此事件期间计数可能少记，需按事件中的 ID、路径和时间补录；同一 ID/路径重复补录不会增加数量。不要将该期间的数字宣称为完整统计。Cloudflare 请求日志自身的保留/采样策略会影响故障补录能力。
