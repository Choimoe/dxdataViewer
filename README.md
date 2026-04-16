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

### Diving-Fish (Default Source)

Fetch Diving-Fish music data, save raw JSON, and generate CSV for frontend rendering:

```sh
pnpm run data:fetch:diving-fish
```

For slow or unstable network, use relaxed mode:

```sh
pnpm run data:fetch:diving-fish:relaxed
```

Run scheduled updates locally (default every 6 hours):

```sh
pnpm run data:schedule:diving-fish
```

Optional environment variables:

- `DIVING_FISH_FETCH_RETRIES` (default `5`)
- `DIVING_FISH_FETCH_TIMEOUT_MS` (default `180000`)
- `DIVING_FISH_FETCH_BACKOFF_MS` (default `2000`)
- `DIVING_FISH_USE_CURL_FALLBACK` (`1` or `0`, default `1`)
- `DIVING_FISH_SKIP_DOWNLOAD` (`1` to reuse local `data/raw/diving-fish/music_data.json`)
- `DIVING_FISH_ALLOW_STALE_JSON` (`1` or `0`, default `1`)
- `DIVING_FISH_UPDATE_INTERVAL_MS` (default `21600000`, used by `data:schedule:diving-fish`)

Generated structure:

```text
data/
  raw/
    diving-fish/
      music_data.json
  csv/
    diving-fish/
      songs.csv
      versions.csv
```

### dxdata

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
