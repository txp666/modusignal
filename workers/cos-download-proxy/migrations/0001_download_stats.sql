CREATE TABLE IF NOT EXISTS website_downloads (
  download_id TEXT NOT NULL,
  asset_path TEXT NOT NULL,
  product TEXT NOT NULL,
  version TEXT NOT NULL,
  os TEXT NOT NULL,
  architecture TEXT NOT NULL,
  package_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (download_id, asset_path)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS website_download_daily (
  day TEXT NOT NULL,
  product TEXT NOT NULL,
  version TEXT NOT NULL,
  os TEXT NOT NULL,
  architecture TEXT NOT NULL,
  package_type TEXT NOT NULL,
  downloads INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, product, version, os, architecture, package_type)
) WITHOUT ROWID;

CREATE TRIGGER IF NOT EXISTS website_download_started AFTER INSERT ON website_downloads
BEGIN
  INSERT INTO website_download_daily (day, product, version, os, architecture, package_type, downloads)
  VALUES (NEW.day, NEW.product, NEW.version, NEW.os, NEW.architecture, NEW.package_type, 1)
  ON CONFLICT(day, product, version, os, architecture, package_type)
  DO UPDATE SET downloads = downloads + 1;
END;
