# dxdataViewer

## Getting Started

clone this repository

```sh
git clone https://github.com/Choimoe/dxdataViewer.git
cd dxdataViewer
```

Install and start dev server

```sh
pnpm install
pnpm run dev
```

## Data Pipeline (Local JSON + CSV)

Fetch the `dxdata` source and generate local files for frontend table rendering:

```sh
pnpm run data:fetch:dxdata
```

For slow or unstable network, use relaxed mode (longer timeout and more retries):

```sh
pnpm run data:fetch:dxdata:relaxed
```

Optional environment variables:

- `DXDATA_FETCH_RETRIES` (default `8`)
- `DXDATA_FETCH_TIMEOUT_MS` (default `600000`)
- `DXDATA_FETCH_BACKOFF_MS` (default `2000`)
- `DXDATA_USE_CURL_FALLBACK` (`1` or `0`, default `1`)
- `DXDATA_SKIP_DOWNLOAD` (`1` to reuse local `data/raw/dxdata/dxdata.json` and only regenerate CSV)
- `DXDATA_ALLOW_STALE_JSON` (`1` or `0`, default `1`)

Generated structure:

```text
data/
  raw/
    dxdata/
      dxdata.json
  csv/
    dxdata/
      songs.csv
      categories.csv
      versions.csv
      types.csv
      difficulties.csv
      regions.csv
      update_time.csv
```
