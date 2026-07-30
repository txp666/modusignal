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
        "qcs::cos:ap-hongkong:uid/1257631357:hartlinkstudio-ota-ap-1257631357/HARTLinkStudio/ota/*"
      ]
    }
  ]
}
```

## Release configuration

Set the HARTLink-Studio repository variable `HARTLINK_OTA_BASE_URL` to:

```text
https://download.modusignal.cn/HARTLinkStudio/ota
```

Keep `TENCENT_COS_PREFIX` set to `HARTLinkStudio/ota`. The publishing workflow writes to COS with its separate upload credential; the Worker credential must stay read-only.

After deploying the Worker and publishing a manifest that points at the download domain, change the COS bucket ACL to private read/write. Direct COS URLs should then return `403`, while the Worker URL should continue returning `200` and `206` for range requests.
